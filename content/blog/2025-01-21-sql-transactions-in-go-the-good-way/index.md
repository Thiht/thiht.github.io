+++
title = "SQL Transactions in Go: The Good Way"
description = "A clean method to write transactions anywhere, without leaking database internals."
date = 2025-01-21

[taxonomies]
tags = ["go"]
+++

In my last work experience, I designed what I consider a pretty cool and efficient way to manage database transactions across a Go codebase. In a nutshell, I wanted to use database transactions in my business logic without exposing database internals.

After dogfooding a solution for a while, I extracted it, improved it, and enriched it, to finally release it as the [transactor](https://github.com/Thiht/transactor) library. This library is now tested across the most common relational databases (PostgreSQL, MySQL, SQLite, MSSQL and Oracle), and is compatible with [`database/sql`](https://pkg.go.dev/database/sql), [jmoiron/sqlx](https://pkg.go.dev/github.com/jmoiron/sqlx) and [jackc/pgx](https://pkg.go.dev/github.com/jackc/pgx/v5).

In my current job, transactors are now our main (soon to be unique!) way to manage database transactions, which is why I feel comfortable talking about this method more widely.

In this article, I’ll walk you through the design and implementation so you can either use the lib, or adapt it and extend it depending on your needs.

## Why exactly do we need a library?

In web services / APIs, it’s customary to use some kind of layered architecture, like Clean Architecture, Hexagonal Architecture, or anything that boils down to a three-tier architecture. In Go, it’s something like:

1. <u>Handlers</u> (a.k.a. controllers): the entrypoints of the API, usually the only layer allowed to be aware of the router and current HTTP request/response handlers,
2. <u>Services</u> (a.k.a. usecases): the business layer, where the domain logic lives,
3. <u>Stores</u> (a.k.a. repositories, data access, storage, persistence…): the layer communicating with databases, caches, filesystems, and so on. It’s usually the only layer allowed to be aware of the concrete storage systems. In practice, it means it’s the only place where `database/sql`, your DB driver, or your ORM should be imported.

Whether transactions should be allowed in the services layer is sometimes up for debate, as they’re somewhat tied to the DB implementation. In Go, a transaction is represented by `*sql.Tx`, but according to the definitions above, using it directly in the services layer would require importing `database/sql`. This is why it’s sometimes accepted that transactions should live in the storage layer only.

**I disagree with this.**

I strongly believe transactions can be used both in the storage layer and in the services layer, for different reasons. Specifically, transactions can be a part of the business logic, and are a part of an interface contract. But I also believe neither `*sql.DB`, `*sql.Tx` or `database/sql` should be imported by the services. This is the reason why I needed to create an object that could be injected to the services, allowing them to make transactions safely across many stores, without exposing any implementation details. The solution to this problem is the [transactor](https://github.com/Thiht/transactor) library.

## The Transactor interface

A transactor lets you create a transactional context, represented by a closure. It’s defined as a simple interface:

```go
type Transactor interface {
  WithinTransaction(context.Context, func(ctx context.Context) error) error
}
```

A transactor implements this interface. We can then inject it in a service, and use it to make some transactional calls completely transparently, without knowing anything about the database. Let's look at some sample code.

### Example code without a transaction

```go
type service struct {
  balanceStore stores.Balance
}

func (s service) IncreaseBalance(
  ctx context.Context,
  account string,
  amount int,
) error {

  balance, err := s.balanceStore.GetBalance(ctx, account)
  if err != nil {
    return err
  }

  balance += amount

  err = s.balanceStore.SetBalance(ctx, account, balance)
  if err != nil {
    return err
  }

  return nil
}
```

This way to manage a financial balance is not great for several reasons, but let’s focus on it as a case study. Without going into too much details (“what transactions are used for” is not the topic here).

This first version, doesn’t use a transaction. It makes it possible to get an inconsistent resulting balance.

### Example code using a transactor

```go
type service struct {
  balanceStore stores.Balance
  transactor Transactor
}

func (s service) IncreaseBalance(
  ctx context.Context,
  account string,
  amount int,
) error {

  return s.transactor.WithinTransaction(ctx, func(ctx context.Context) error {
    balance, err := s.balanceStore.GetBalance(ctx, account)
    if err != nil {
      return err
    }

    balance += amount

    err = s.balanceStore.SetBalance(ctx, account, balance)
    if err != nil {
      return err
    }

    return nil
  })
}
```

This second version wraps `GetBalance` and `SetBalance` in a transaction, essentially making the operation atomic.

The changes made when using the Transactor are minimal, as they just impact 2-3 lines in this case, but here’s what happens in details:

1. `WithinTransaction` accepts a context and a callback:
    1. The context will be enriched with the transaction ; more on that later,
    2. The enriched context is passed to the callback, which I call a *transactional context,*
    3. To keep the changes minimal, the parent context is shadowed in the callback by naming it `ctx` ; this has no unintended effects, and makes it impossible to misuse the transactor (eg. by using the wrong context in one of the calls),
2. `WithinTransaction` does essentially three things to manage the transaction workflow:
    1. Begin the transaction,
    2. Execute the callback,
    3. Commit, or Rollback the transaction.

This workflow is detailed in the flowchart below.

<pre class="mermaid bg-transparent">
flowchart TD
  Start((Start)) --> Begin["Begin transaction"]
  Begin --> ErrBegin{Error?}
  ErrBegin -- no --> Callback["Execute callback"]
  ErrBegin -- yes --> RetErrBegin([Return error])
  Callback --> ErrCallback{Error?}
  ErrCallback -- no --> Commit
  ErrCallback -- yes --> RollbackCallback["Rollback"]
  RollbackCallback --> RetErrCallback([Return error])
  Commit --> ErrCommit{Error?}
  ErrCommit -- no --> Success([Success])
  ErrCommit -- yes --> RetErrCommit([Return error])

  classDef failure stroke:#eb2f06,fill:#e55039
  classDef success stroke:#079992,fill:#38ada9
  class RetErrBegin,RollbackCallback,RetErrCallback,RetErrCommit failure
  class Success success
</pre>

And voilà! The transactor makes **using transactions fool proof, and extremely easy**.

And the best thing is, there’s more.

## Nesting transactions

Transactors, when properly implemented, make it possible to deal with [**nested transactions**](https://en.wikipedia.org/wiki/Nested_transaction). The implementation for nested transactions varies depending on the database, but the transactor library provides an implementation for all the major systems.

You can use a transactor anywhere, and you don’t have to worry if the methods you call use a transactor themselves. As an example, the following code making use of our previously defined `IncreaseBalance` is completely valid and working as you would expect:

```go
func (s service) TransferBalance(
  ctx context.Context,
  fromAccount, toAccount string,
  amount int,
) error {

  return s.transactor.WithinTransaction(ctx, func(ctx context.Context) error {
    err := s.DecreaseBalance(ctx, fromAccount, amount)
    if err != nil {
      return err
    }

    err = s.IncreaseBalance(ctx, toAccount, amount)
    if err != nil {
      return err
    }

    return nil
  })
}
```

or, more generally:

```go
if err := s.transactor.WithinTransaction(ctx, func(ctx context.Context) error {

  // Do some stuff before the nested transaction

  if err := s.transactor.WithinTransaction(ctx, func(ctx context.Context) error {

    // Do some stuff inside the nested transaction

  }; err != nil {
    // Handle rollback of the nested transaction
  }

  // Do some stuff after the nested transaction

}; err != nil {
  // Handle rollback of the main transaction
}
```

Just like that, we made **transactional methods composable inside a larger transaction**. Compared to other ways of dealing with transactions, such as [Unit of Work](https://en.wikipedia.org/wiki/Unit_of_work), transactors make it really straightforward to compose anything inside a transaction: store methods, methods across different stores (working on the same storage system), or business services.

## Implementing a `database/sql` Transactor

To illustrate the above, let’s dive into the implementation of a transactor for `database/sql` from the Go standard library.

The full reference implementation can be found in [transactor/stdlib/transactor.go](https://github.com/Thiht/transactor/blob/main/stdlib/transactor.go).

The very basic structure we’ll need will evolve a bit as we go, but let’s get started:

```go
package transactor

import (
  "context"
  "database/sql"
)

type Transactor interface {
  WithinTransaction(context.Context, func(ctx context.Context) error) error
}

type transactor struct{
  db *sql.DB
}

var _ Transactor = &transactor{}

func NewTransactor(db *sql.DB) *transactor {
  return &transactor{db: db}
}

func (t *transactor) WithinTransaction(ctx context.Context, txFunc func(context.Context) error) error {
  return nil
}
```

In this first step, we create a private `transactor` implementing the `Transactor` interface.

`*sql.DB` is a database handler representing an active connection to the database. It’s the result of [`sql.Open`](https://pkg.go.dev/database/sql#Open).

- - -

With the general structure in place, we can start implementing the `WithinTransaction` logic. As we expect it, its role will be to manage the transaction and execute the provided callback within this context.

```go
func (t *transactor) WithinTransaction(ctx context.Context, txFunc func(context.Context) error) error {
  tx, err := t.db.BeginTx(ctx, nil)
  if err != nil {
    return fmt.Errorf("failed to begin transaction: %w", err)
  }

  txCtx := txToContext(ctx, tx)
  if err := txFunc(txCtx); err != nil {
    _ = tx.Rollback()
    return err
  }

  if err := tx.Commit(); err != nil {
    return fmt.Errorf("failed to commit transaction: %w", err)
  }

  return nil
}
```

This implementation already deals with most of the workflow: the transaction is started with `BeginTx`, the `txFunc` callback is then executed, and the transaction is either `Commit`ted or `Rollback`ed depending on the callback result.

The actual magic happens at line 7, with the `txToContext` function call:

- `txToContext` stores the transaction (an `*sql.Tx` instance) as a context key,
- the context, enriched with the transaction, is passed to the callback function.

We can implement `txToContext` like this:

```go
type txCtxKey struct{}

func txToContext(ctx context.Context, tx pgx.Tx) context.Context {
  return context.WithValue(ctx, txCtxKey{}, tx)
}
```

Using a private struct type as a context key ensures nothing will conflict: this key can only be set by using `txCtxKey`.

- - -

At this point, the transactor logic is done. The actual [`transactor/stdlib`](https://pkg.go.dev/github.com/Thiht/transactor@v1.1.0/stdlib) implementation is a bit more complex because it can deal with nested transactions, but the logic is the same.

The only thing we miss is a way to actually use our transactor. When making our database queries, we must either check if our context contains a transaction, or use the DB connection directly.

To do so, we need a helper to give us the current transaction or connection from a context: the `DBGetter`. Let’s modify the `NewTransactor` constructor to give us a `DBGetter`:

```go
type DBGetter func(context.Context) DB

func NewTransactor(db *sql.DB) (*transactor, DBGetter) {
  return &transactor{db: db},
    func(ctx context.Context) DB {
      if tx := txFromContext(ctx); tx != nil {
        return tx
      }

      return db
    }
}
```

`txFromContext` does the opposite of our previous `txToContext` function and is implemented as:

```go
func txFromContext(ctx context.Context) pgx.Tx {
  tx, ok := ctx.Value(txCtxKey{}).(pgx.Tx)
  if ok {
    return tx
  }

  return nil
}
```

`DB` is simply an interface defining the common methods between [`*sql.DB`](https://pkg.go.dev/database/sql#DB) and [`*sql.Tx`](https://pkg.go.dev/database/sql#Tx), so that we can use a DB handler or a transaction indistinctly:

```go
type DB interface {
  ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
  PrepareContext(ctx context.Context, query string) (*sql.Stmt, error)
  QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
  QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}
```

The `DBGetter` we define will always return the initial `*sql.DB` handler by default, even if the context is completely empty (eg. `context.Background()` or `nil`), which makes it safe to use anywhere. The only way it can return a transaction is if it’s called inside a `WithinTransaction` block, as part of the `txFunc` callback we defined earlier.

- - -

These changes conclude the transactor implementation. As you’ll see in the examples below, the key for it to work as intended is to **always use the `DBGetter`** to make database queries, never the `*sql.DB` directly. This is the only way that these functions will know to use an active transaction.

The following code is an example implementation of the `balanceStore` described at the beginning of this article, making use of the `DBGetter`:

```go
type balanceStore struct {
	dbGetter DBGetter
}

func (s balanceStore) GetBalance(ctx context.Context, account string) (int, error) {
  var amount int
  err := s.dbGetter(ctx).QueryRow(ctx, "SELECT amount FROM balances WHERE id = $1 FOR UPDATE", account).Scan(&amount)
  return amount, err
}

func (s balanceStore) SetBalance(ctx context.Context, account string, balance int) error {
  _, err := s.dbGetter(ctx).Exec(ctx, "UPDATE balances SET amount = $1 WHERE id = $2", amount, account)
  return err
}

func main() {
  ctx := context.Background()

  db, _ := sql.Open("<driver>", "<dsn>")

  transactor, dbGetter := transactor.NewTransactor(db)

  balanceStore := balanceStore{dbGetter: dbGetter}

  err := transactor.WithinTransaction(ctx, func(ctx context.Context) error {
		balance, err := balanceStore.GetBalance(ctx, "account-1")
		if err != nil {
			return err
	  }

		balance += 10

		err = s.balanceStore.SetBalance(ctx, "account-1", balance)
	  if err != nil {
	    return err
	  }

    return nil
  })
  if err != nil {
    // ❌ Transaction rollbacked
    return
  }

  // ✅ Transaction committed
}
```

- - -

Using the context to pass information is sometimes controversial in the Go community, but in this case I feel the benefits vastly outweigh the cons. In fact, after using transactors for almost a full year in various situations, I'd say there isn't anything that would make me go back to an alternative method for managing transactions.

Anyway, that’s it for today! I hoped you enjoyed this article, and if you did, I encourage you to give my [transactor](https://github.com/Thiht/transactor) library a try in one of your projects, and [maybe ⭐ it on GitHub](https://github.com/Thiht/transactor/stargazers)!
