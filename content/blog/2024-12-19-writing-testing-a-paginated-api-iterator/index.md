+++
title = "Writing & Testing a Paginated API Iterator in Go"
description = "Writing and unit-testing Go 1.23 iterators can be tricky. This article shows a full-featured example using GitHub's public API."
date = 2024-12-19

[taxonomies]
tags = ["go", "testing"]
+++

**Go 1.23**, amongst [other features](https://tip.golang.org/doc/go1.23), brought [Iterators](https://pkg.go.dev/iter) to the standard library.

Iterators are basically a way to make the `range` operator work on functions implementing a specific interface. This lets you write code like this:

```go
for value := range myIterator() {
  // ...
}
```

The main difference with using `range` over a slice or a map is that an iterator can fetch data lazily. I doesn’t need to fetch all the data at once before writing the loop. This comes really handy for consuming paginated APIs: we can write an iterator abstracting the pagination logic, making the code more readable and reusable.

In this article I’ll show you how to **write a custom iterator** for consuming a paginated HTTP API (we’ll use GitHub’s API as an example), and how to **test it** properly by leveraging [Pull Iterators](https://pkg.go.dev/iter#hdr-Pulling_Values).

---

Note that this article will not discuss the design of iterators in Go, we’ll just see how to use and work with them. For more information on iterators, I recommend these articles:

- [Ranging over functions in Go 1.23](https://eli.thegreenplace.net/2024/ranging-over-functions-in-go-123/)
- [Range Over Function Types](https://go.dev/blog/range-functions)

## Writing an Iterator

Iterators can return up to two values. They must implement one of these signatures:

- [`iter.Seq`](https://pkg.go.dev/iter#Seq) (`func(yield func(V) bool`): iterators over sequences of 1 value
- [`iter.Seq2`](https://pkg.go.dev/iter#Seq2) (`func(yield func(K, V) bool`): iterators over sequences of 2 values
- `func(yield func() bool)`: iterators over sequence of… no value :)

For iterators working over remote resources like APIs, the emerging idiom is to use the second value for error handling. In practice, using our iterator will look like this:

```go
// IterateResources is a function returning an iter.Seq2[K, error]
for resource, err := range IterateResources(ctx, apiClient) {
    if err != nil {
        // handle error
        break
    }

    // use resource
}
```

I noticed a few naming conventions for functions returning an iterator:

- `IterateResources`
- `IterResources`
- `ResourcesSeq`

I’m not sure yet which is the more common, but I went with `Iterate` in this article as it feels clearer.

---

We’ll implement an iterator looking like the above using the [GitHub API to list the repositories of a user](https://docs.github.com/fr/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-a-user).


I chose this API for 3 reasons:

1. it's public and doesn't require authentication. You can give it a try in a terminal:
    ```sh
    curl 'https://api.github.com/users/thiht/repos?page=1&per_page=5'
    ```
2. it's paginated, so it's a good use-case for an iterator,
3. the Go module [google/go-github](https://pkg.go.dev/github.com/google/go-github/v67@v67.0.0) is readily available to interact with the GitHub API.

With [google/go-github](https://pkg.go.dev/github.com/google/go-github/v67@v67.0.0), we’ll use the [RepositoriesService.ListByUser](https://pkg.go.dev/github.com/google/go-github/v67@v67.0.0/github#RepositoriesService.ListByUser) method. As a starting point, let’s write a version of the code listing all [my repositories](https://github.com/Thiht?tab=repositories), without an iterator.

```go
package main

import (
  "context"

  "github.com/google/go-github/v67/github"
)

func main() {
  ctx := context.Background()
  client := github.NewClient(nil)

  user := "thiht"

  opts := &github.RepositoryListByUserOptions{
    ListOptions: github.ListOptions{
      Page:    1,
      PerPage: 5,
    },
  }

  for {
    repos, resp, err := client.Repositories.ListByUser(ctx, user, opts)
    if err != nil {
      panic(err)
    }

    for _, repo := range repos {
      println(*repo.FullName)
    }

    if resp.NextPage == 0 {
      break
    }
    opts.Page = resp.NextPage
  }
}
```

The pagination parameters are passed via `ListOptions`, and the next page to fetch is retrieved at each loop from the `resp` result. I set the pagination settings to list the repositories 5 by 5 so that we get a chance to see the pagination in action.

This code works fine, but it forces us to mix the pagination logic (checking the `NextPage` value and updating `opts.Page`) with our business logic (printing the repository name). It also suffers from a lack of standardization: any API you use will be different. Not only REST APIs, but also filesystem APIs, custom collections, or whatever. Iterators will help us abstract anything related to the pagination and focus on our own logic.

Let’s now rewrite the same code with an iterator:

```go
package main

import (
  "context"
  "iter"

  "github.com/google/go-github/v67/github"
)

// 1. Iterator usage
func main() {
  ctx := context.Background()
  client := github.NewClient(nil)

  user := "thiht"

  for repo, err := range IterateRepositoriesByUser(
    ctx, client.Repositories, user, nil,
  ) {
    if err != nil {
      panic(err)
    }

    println(*repo.FullName)
  }
}

// 2. Iterator implementation
func IterateRepositoriesByUser(
  ctx context.Context, client RepositoryLister, user string,
  opts *github.RepositoryListByUserOptions,
) iter.Seq2[*github.Repository, error] {
  return func(yield func(*github.Repository, error) bool) {

    // 2.1. Initialization

    if opts == nil {
      opts = &github.RepositoryListByUserOptions{}
    }

    if opts.Page == 0 {
      opts.Page = 1
    }

    if opts.PerPage == 0 {
      opts.PerPage = 5
    }

    // 2.2. Pagination loop

    for {
      repos, response, err := client.ListByUser(ctx, user, opts)
      if err != nil {
        yield(nil, err)
        return
      }

      for _, repo := range repos {
        if !yield(repo, nil) {
          return
        }
      }

      if response.NextPage == 0 {
        return
      }
      opts.Page = response.NextPage
    }
  }
}

type RepositoryLister interface {
  ListByUser(
    ctx context.Context, user string,
    opts *github.RepositoryListByUserOptions,
  ) ([]*github.Repository, *github.Response, error)
}
```

As you can see, the iterator version is slightly more verbose, but it's more reusable and has the benefit of isolating the pagination logic from the rest of the code. Keep in mind in real life projects you’ll modify the business logic of the loop more often than you’ll modify the iterator itself, so it makes sense to take a bit of time writing an iterator to get simpler business code.

`IterateRepositoriesByUser` is not an iterator itself, but a function returning an iterator. This lets us pass the parameters that will be available in the scope of the iterator: the context, the GitHub client, the target user, and the additional options.

I declared a `RepositoryLister` interface to make it easier to test the iterator, we’ll come back to it in the next part.

The iterator consists of these steps:

- **2.1:** Initialization of the pagination params before calling the API: the pagination starts at page 1 on the GitHub API,
- **2.2:** Main loop listing the user’s repositories. Note that this is roughly the same code we had in the implementation without iterator: the pagination logic stays the same. The main difference is the use of `yield` to return our values and errors to `range`:
    - If `ListByUser` fails, yield the error and return: I decided to return unconditionally in case of failure, because I want the `range` to end if `ListByUser` fails.
    - If `ListByUser` succeeds, the repositories are yielded one by one.

As a reminder:

- `yield` returns `true` if the `range` loop continues (if the `continue` keyword is used, or if the loop continues to the next iteration),
- `yield` returns `false` if the `range` loop stops (if `break` or `return` are used, or if the loop is interrupted).

## Testing the Iterator

It can be a bit challenging to write tests for an iterator. In our tests we need to make sure that:

- the iterator contains the elements we expect, in the correct order,
- the iterator doesn’t contain **more** elements than we expect.

### Mocking `RepositoryLister`

Using a mock is not the only way to write this test, just my personal preference. As `github.NewClient` accepts an `*http.Client` as a parameter, we could instead use [`net/http/httptest`](https://pkg.go.dev/net/http/httptest) to control the HTTP calls and their responses.

In the above example, we used an interface `RepositoryLister` to abstract the GitHub API client. Thanks to this abstraction, we can mock the GitHub API client in our tests. We could use a mocking library like [mockery](https://vektra.github.io/mockery/latest/) to generate a mock for this interface automatically, but I'll write it manually for this example:

```go
import (
  "context"
  "fmt"
  "testing"

  "github.com/google/go-github/v67/github"
)

type repositoryListerMock struct {
  t     *testing.T
  calls []callListByUser
}

type callListByUser struct {
  expectPage int
  repos      []*github.Repository
  resp       *github.Response
  err        error
}

func newRepositoryListerMock(t *testing.T, calls ...callListByUser) *repositoryListerMock {
  mock := repositoryListerMock{t: t, calls: calls}
  t.Cleanup(func() {
    if len(mock.calls) > 0 {
      t.Fatalf("%d unfulfilled calls to ListByUser", len(mock.calls))
    }
  })
  return &mock
}

func (r *repositoryListerMock) ListByUser(ctx context.Context, user string, opts *github.RepositoryListByUserOptions) ([]*github.Repository, *github.Response, error) {
  r.t.Helper()

  if len(r.calls) == 0 {
    r.t.Fatal("no result registered for ListByUser")
  }

  if opts.Page != r.calls[0].expectPage {
    r.t.Fatalf("unexpected page: got %d, want %d", opts.Page, r.calls[0].expectPage)
  }

  result := r.calls[0]
  r.calls = r.calls[1:]

  return result.repos, result.resp, result.err
}
```

This mock lets you register the expected calls to `ListByUser` and the results you want to return.
It can be used as follows, in place of a `RepositoryLister`:

```go
func Test_repositoryListerMock(t *testing.T) {
  mockClient := newRepositoryListerMock(t,
    callListByUser{ // First call
      expectPage: 1,
      repos: []*github.Repository{
        {FullName: github.String("example")},
      },
      resp: &github.Response{NextPage: 2},
    },
    callListByUser{ // Second call
      expectPage: 2,
      err:        fmt.Errorf("an error occurred"),
    },
  )

  repos, resp, err := mockClient.ListByUser(context.Background(), "thiht", &github.RepositoryListByUserOptions{
    ListOptions: github.ListOptions{Page: 1},
  })
  if err != nil {
    t.Errorf("unexpected error %v:", err)
  }
  if len(repos) != 1 {
    t.Errorf("unexpected number of repositories: got %d, want %d", len(repos), 1)
  }
  if *repos[0].FullName != "example" {
    t.Errorf("unexpected repository name: got %q, want %q", *repos[0].FullName, "example")
  }
  if resp.NextPage != 2 {
    t.Errorf("unexpected next page: got %d, want %d", resp.NextPage, 2)
  }

  _, _, err = mockClient.ListByUser(context.Background(), "thiht", &github.RepositoryListByUserOptions{
    ListOptions: github.ListOptions{Page: 2},
  })
  if err == nil {
    t.Errorf("expected error, got nil")
  }

  // An additional call to ListByUser will fail because there are no more results
  // mockClient.ListByUser(context.Background(), "thiht", nil)
}
```

### Writing tests for the sequence

To test an iterator, I find it easier to first write down the expected sequence of values it returns. To do so, we can start by defining a type to represent the 2 values returned by an iteration:

```go
  type iteration struct {
    repo *github.Repository
    err  error
  }
```

This way we’ll be able to declare an expected sequence for a test:

```go
expectedIterations := []iteration{
  {repo: &github.Repository{FullName: github.String("example1")}},
  {repo: &github.Repository{FullName: github.String("example2")}},
}
```

Before writing our test, let’s setup our GitHub client mock with the expected responses to match this expected sequence:

```go
client := &repositoryListerMock{
  t: t,
  calls: []callListByUser{
    {
      expectPage: 1,
      repos: []*github.Repository{
        {FullName: github.String("example1")},
        {FullName: github.String("example2")},
      },
      resp: &github.Response{NextPage: 0},
    },
  },
}
```

Our `repositoryListerMock` implements ListByUser, will return 2 repositories on the first page, and signal there’s no next page to fetch.

With all of this setup, we can finally test the iterator itself. The first trick here is to convert our iterator to a **pull iterator** to get finer control over the iteration sequence:

```go
// 1. Initialize the iterator
next, stop := iter.Pull2(IterateRepositoriesByUser(context.Background(), client, "thiht", nil))
t.Cleanup(stop)

// 2. Iterate and compare to the expected sequence
for _, expected := range expectedIterations {
  repo, err, ok := next()
  if !ok {
    t.Fatal("unexpected end of iteration")
  }

  if !reflect.DeepEqual(repo, expected.repo) {
    t.Errorf("unexpected repository: got %+v, want %+v", repo, expected.repo)
  }
  if err != expected.err {
    t.Errorf("unexpected error: got %v, want %v", err, expected.err)
  }
}

// 3. Ensure the iterator is empty
if _, _, ok := next(); ok {
  t.Fatal("unexpected iteration")
}
```

The actual testing consists of 3 parts:

1. First, the iterator is initialized by calling `IterateRepositoriesByUser` with its expected parameters, including the mock client we created previously. We call [`iter.Pull2`](https://pkg.go.dev/iter#Pull2) to convert the iterator to a push iterator, which gives us 2 new variables: `next` and `stop`. `next` will give us the next values in the iterator, and a boolean indicating whether it still contained values.
2. Then, we loop on the `expectedIterations`. That’s the second trick, we don’t loop directly on the iterator but instead on the sequence we expect. This lets us check all the values we expect one by one.
    - The first action in the loop is to call `next` to iterate. If the `ok` value returned by the iterator is `false` it means we expected more values than the iterator gave us, so the test fails.
    - Then, we can simply check that the returned `*github.Repository` and `error` are the ones we expected.
3. Finally we need to call `next` one last time to ensure the iterator is empty. If the `ok` value is `true`, it means the iterator contains more values than we expected. The test fails, and we need to rework our `expectedSequence`.

This approach makes it easy to test all the possible cases for this iterator. The below examples show how to write a few additional tests, such as an iterator calling multiple pages of results, or an iterator returning an unexpected error.

```go
func TestIterateRepositoriesByUser(t *testing.T) {
	type iteration struct {
		repo *github.Repository
		err  error
	}

	t.Run("1 page of repositories", func(t *testing.T) {
		client := &repositoryListerMock{
			t: t,
			calls: []callListByUser{
				{
					expectPage: 1,
					repos: []*github.Repository{
						{FullName: github.String("example1")},
						{FullName: github.String("example2")},
					},
					resp: &github.Response{NextPage: 0},
				},
			},
		}

		expectedIterations := []iteration{
			{repo: &github.Repository{FullName: github.String("example1")}},
			{repo: &github.Repository{FullName: github.String("example2")}},
		}

		next, stop := iter.Pull2(IterateRepositoriesByUser(context.Background(), client, "thiht", nil))
		t.Cleanup(stop)

		for _, expected := range expectedIterations {
			repo, err, ok := next()
			if !ok {
				t.Fatal("unexpected end of iteration")
			}

			if !reflect.DeepEqual(repo, expected.repo) {
				t.Errorf("unexpected repository: got %+v, want %+v", repo, expected.repo)
			}
			if err != expected.err {
				t.Errorf("unexpected error: got %v, want %v", err, expected.err)
			}
		}

		if _, _, ok := next(); ok {
			t.Fatal("unexpected iteration")
		}
	})

	t.Run("2 pages of repositories", func(t *testing.T) {
		client := &repositoryListerMock{
			t: t,
			calls: []callListByUser{
				{
					expectPage: 1,
					repos: []*github.Repository{
						{FullName: github.String("example1")},
					},
					resp: &github.Response{NextPage: 2},
				},
				{
					expectPage: 2,
					repos: []*github.Repository{
						{FullName: github.String("example2")},
					},
					resp: &github.Response{NextPage: 0},
				},
			},
		}

		expectedIterations := []iteration{
			{repo: &github.Repository{FullName: github.String("example1")}},
			{repo: &github.Repository{FullName: github.String("example2")}},
		}

		next, stop := iter.Pull2(IterateRepositoriesByUser(context.Background(), client, "thiht", nil))
		t.Cleanup(stop)

		for _, expected := range expectedIterations {
			repo, err, ok := next()
			if !ok {
				t.Fatal("unexpected end of iteration")
			}

			if !reflect.DeepEqual(repo, expected.repo) {
				t.Errorf("unexpected repository: got %+v, want %+v", repo, expected.repo)
			}
			if err != expected.err {
				t.Errorf("unexpected error: got %v, want %v", err, expected.err)
			}
		}

		if _, _, ok := next(); ok {
			t.Fatal("unexpected iteration")
		}
	})

	t.Run("api error", func(t *testing.T) {
		clientErr := fmt.Errorf("an error occurred")

		client := &repositoryListerMock{
			t: t,
			calls: []callListByUser{
				{
					expectPage: 1,
					err:        clientErr,
				},
			},
		}

		expectedIterations := []iteration{
			{err: clientErr},
		}

		next, stop := iter.Pull2(IterateRepositoriesByUser(context.Background(), client, "thiht", nil))
		t.Cleanup(stop)

		for _, expected := range expectedIterations {
			repo, err, ok := next()
			if !ok {
				t.Fatal("unexpected end of iteration")
			}

			if !reflect.DeepEqual(repo, expected.repo) {
				t.Errorf("unexpected repository: got %+v, want %+v", repo, expected.repo)
			}
			if err != expected.err {
				t.Errorf("unexpected error: got %v, want %v", err, expected.err)
			}
		}

		if _, _, ok := next(); ok {
			t.Fatal("unexpected iteration")
		}
	})

	t.Run("no repositories", func(t *testing.T) {
		client := &repositoryListerMock{
			t: t,
			calls: []callListByUser{
				{
					expectPage: 1,
					repos:      []*github.Repository{},
					resp:       &github.Response{NextPage: 0},
				},
			},
		}

		next, stop := iter.Pull2(IterateRepositoriesByUser(context.Background(), client, "thiht", nil))
		t.Cleanup(stop)

		if _, _, ok := next(); ok {
			t.Fatal("unexpected iteration")
		}
	})
}
```
