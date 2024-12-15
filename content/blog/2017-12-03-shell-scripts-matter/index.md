+++
title = "Shell Scripts Matter"
description = "Learn how to follow good development practices, even with Bash!"
date =  2017-12-03
aliases = ["2017/12/03/shell-scripts-matter.html"]
+++

<img class="mx-auto" src="./bash-logo.png" alt="Bash logo">

The shell is an odd beast. Although it goes against every current trend in software engineering (strong typing, compile checks over runtime checks, ...), shell scripts are here to stay, and still constitute an important part of every developer's life.

The weird thing about shell scripts is that even strong advocates of good practices gladly forget all they know when it comes to shell scripting.

> Versioning? Why bother, it's disposable code.
>
> Code quality? That's just a shell script, it's garbage anyway.
>
> Testing? Nah. There aren't any decent tools for that.

Wrong, wrong, and wrong. Shell scripts have value. **Everything you do for real code should be done for non trivial shell scripts**, even for a one-time script. That includes versioning, code reviews, continuous integration, static code analysis, and testing.

Here is a summary of everything that can, and should be done when writing shell scripts.

**Note:** This article will use Bash as a reference shell. Most of the content can be transposed to other POSIX compliant shells.

## Keep your scripts in version control

Keeping shell scripts under version control has multiple advantages:

* It constitutes a library. Shell scripts can be hard to write. If there's a reference for something difficult somewhere, your coworkers will thank you when they need it. **You should setup a "shell-scripts" repository** somewhere as soon as possible.
* They can be properly reviewed. Making mistakes is easy with shell scripts, and they can be very damaging. **Code review should be mandatory for shell scripts**, as for any other piece of code.
* They can be improved. I won't explain to you what version control is. But with shell scripts versioned, it's easy to improve them regularly.

Please, from now on, **version all your shell scripts** before running them. **Have someone reviewing your scripts in priority** before executing them in production. It's not a waste of your coworkers' time, it's a time saver for the team.

## Improve the quality of your scripts with ShellCheck

Although you can check the syntactic validity of your scripts with the command `bash -n`, much powerful tools exist.

[ShellCheck](https://www.shellcheck.net/) is a static code analysis tool for shell scripts. It's really an awesome tool which will help you improve your skills as you use it. **So do use it**. You can [install it globally on your machine](https://github.com/koalaman/shellcheck#installing), use it in your [continuous integration](https://github.com/koalaman/shellcheck#travis-ci-setup), and it even [integrates perfectly with most major editors](https://github.com/koalaman/shellcheck#in-your-editor). There really are no downsides to using ShellCheck and it can save you from yourself.

If Steam had used ShellCheck in 2015, [this line would never have made it to production](https://linux.slashdot.org/story/15/01/16/1429201/steam-for-linux-bug-wipes-out-all-of-a-users-files):

```bash
rm -rf "$STEAMROOT/"*
```

This code violates the [SC2115 rule](https://github.com/koalaman/shellcheck/wiki/SC2115) from ShellCheck.

## Use Bash unofficial strict mode

The unofficial strict mode comes from Aaron Maxwell's article "[Use the Unofficial Bash Strict Mode (Unless You Looove Debugging)](http://redsymbol.net/articles/unofficial-bash-strict-mode/)". He suggests to start every Bash script with the following lines:

```bash
#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
```

* `set -e` will exit the script if any command returns a non-zero status code. To prevent the option from triggering on commands returning a non-zero status code even when no error occurred, there are two solutions:

  * using the `|| true` pattern:

    ```bash
    command_returning_non_zero || true
    ```

  * temporary disabling the option:

    ```bash
    set +e
    command_returning_non_zero
    set -e
    ```

* `set -u` will prevent using an undefined variable. In the case of undefined positional parameters (`$1`, `$2`, ...), you can give them a default value with the [parameter expansion](https://www.gnu.org/software/bash/manual/html_node/Shell-Parameter-Expansion.html) construct:

  ```bash
  my_arg=${1:-"default"}
  ```

* `set -o pipefail` will force pipelines to fail on the first non-zero status code.

* `IFS=$'\n\t'` makes iterations and splitting less surprising, in the case of loops mostly. The default for this variable is usually `IFS=$' \n\t'` but the space as a separator often gives confusing results.

Read the [original article](http://redsymbol.net/articles/unofficial-bash-strict-mode/) for more details and [solutions for common challenges when using the strict mode](http://redsymbol.net/articles/unofficial-bash-strict-mode/#issues-and-solutions)!

The unofficial strict mode is more intrusive than what we've seen before and can be hard to deal with, but it's worth it in the long run. Take the time to try it.

## Do some cleanup!

When scripts are interrupted, either because of a user's action or because something bad occurred, most shell scripts don't clean up their mess. In the worst case, they might not restart services they had to temporarily disable. It's a shame given how easy it is to perform some cleanup and error catching with the `trap` command.

Once again, in "[How "Exit Traps" Can Make Your Bash Scripts Way More Robust And Reliable](http://redsymbol.net/articles/bash-exit-traps/)", Aaron Maxwell gives some great advice.

Always add the following in your shell scripts:

```bash
cleanup() {
    # ...
}
trap cleanup EXIT
```

The `trap` command will execute the `cleanup` function as soon as the script exits. In this function you could remove temporary files, restart services, or whatever is relevant to your script.

## Test your scripts with shUnit2

[shUnit2](https://github.com/kward/shunit2) is a unit testing framework for shell scripts. It's inspired by JUnit. It's available in the standard repositories so you can install it with `apt-get install shunit2` on an Ubuntu-based distro.

shUnit2 consists of a shell script you can `source` in your test file. To use it, there are multiple approaches. In order not to clutter the main script, I prefer writing the tests in a separate file. This means I'll have a `script.sh` file and a `test_script.sh` file.

Below is an example for a script offering a function to add two numbers.

`add.sh` must have the following structure:

```bash
add() {
    local a=$1
    local b=$2
    echo $(( a + b ))
}

if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then
    # Main code of the script
    add $1 $2
fi
```

The `[[ "${BASH_SOURCE[0]}" = "$0" ]]` test is used to execute the main code only when the script is executed directly, not `source`d.

`test_add.sh` will look like this:

```bash
. ./add.sh

test_add() {
    actual=$(add 5 8)
    expected=13
    assertEquals "$expected" "$actual"
}

. shunit2
```

First, the test file `source`s the main file `add.sh` (in Bash, `.` is an alias to `source`). The functions it declares are then available in the test script.

The actual tests are simple functions with a name starting by `test`. At the end, the globally installed `shunit2` is `source`d and performs its [magic](http://ssb.stsci.edu/testing/shunit2/shunit2.html#quickstart).

The test file can then be executed:

```
$ bash test_add.sh
test_add

Ran 1 test.

OK
```

The details of what shUnit2 can do are explained in [its documentation](http://ssb.stsci.edu/testing/shunit2/shunit2.html#function-reference).

There are alternatives to shUnit2, such as [Bats](https://github.com/sstephenson/bats) or [Roundup](https://bmizerany.github.io/roundup/) but I didn't have a chance to use them yet. Their usage should be relatively similar though. The point of this section is that **testing shell scripts is doable and should be done**, whatever solution you choose in the end.

## Log what your script is doing

In the past, I made the mistake of not logging anything. I liked running a script and seeing it work magically without anything ugly showing in the console. I was wrong, because when something doesn't work as expected, it becomes impossible to know what happened. Running a script is not supposed to feel like magic, it must be somewhat verbose and understandable. For that, please **log as much as possible in your scripts**.

For this purpose, I usually add the following lines in my scripts:

```bash
readonly LOG_FILE="/tmp/$(basename "$0").log"
info()    { echo "[INFO]    $*" | tee -a "$LOG_FILE" >&2 ; }
warning() { echo "[WARNING] $*" | tee -a "$LOG_FILE" >&2 ; }
error()   { echo "[ERROR]   $*" | tee -a "$LOG_FILE" >&2 ; }
fatal()   { echo "[FATAL]   $*" | tee -a "$LOG_FILE" >&2 ; exit 1 ; }
```

This tiny logging framework allows to easily keep track of whatever happens during the script execution. Logging becomes as simple as writing `info "Executing this and that..."`. Then it's easy to `grep` on the log file to find something specific. Feel free to improve these functions as you need, with the date, the calling function name (with `$FUNCNAME`), etc.

I don't use the builtin [`logger`](http://man7.org/linux/man-pages/man1/logger.1.html) because it requires special privileges to write to `/var/log` and I'm not fond of its usage. Writing to a log file in `/tmp` is usually good enough. For `cron` scripts though you should probably investigate `logger`.

Use the `-v` or `--verbose` of the commands you invoke as needed to improve the quality of your logging.

## Learn to debug your scripts

The easiest way to debug a shell script, besides logging, is to run it with `bash -x`. Another way is to use `set -x` inside the script. This option will make Bash print every command before its execution, replacing the variables with their real values. Used together with the unofficial strict mode, this method is useful to see what's going on in a script with less risk to break the environment.

It's also worth knowing that a few debuggers for Bash exist, for example [bashdb](http://bashdb.sourceforge.net/bashdb.html). bashdb works in the same way as gdb, and can be used to add breakpoints, switching to step by step execution, showing the value of variables, etc. You can learn how to use bashdb with the video "[Using BashDB to Debug Your Shell Scripts ](https://www.youtube.com/watch?v=jbOQJDSTksA)":

{{ youtube(id="jbOQJDSTksA") }}

## Document your scripts

Any shell script should have a `--help` option. This doesn't seem easy? It is, thanks to the following wizardry:

```bash
#/ Usage: add <first number> <second number>
#/ Compute the sum of two numbers
usage() {
    grep '^#/' "$0" | cut -c4-
    exit 0
}
expr "$*" : ".*--help" > /dev/null && usage
```

The `usage` function will print every line starting with `#/` comments, without this prefix.

The `expr` command will check if the string resulting of the concatenation of all the parameters contains `--help`. If so, it will call `usage`.

This is definitely not the cleanest way to parse parameters, but this quick method ensures you will add a `--help` flag.

For the sake of good practices, [this StackOverflow post](https://stackoverflow.com/a/14203146/1544176) explains how to properly parse a script's parameters using the `while`/`case`/`shift` construct.

To generate HTML documentation from your comments, you can also check [shocco.sh](http://rtomayko.github.io/shocco/), which inspired [the above trick](https://github.com/rtomayko/shocco/blob/e4660e563559d5bd9acbca42b61115e72b54667f/shocco.sh#L54-L57).

## Random advice

The following is a list of random good practices I've learned the hard way. I'll explain the rationale behind every advice as I go.

### Use Bash for scripting

Use Bash by default, Sh if you have to. Try to forget about Ksh, Zsh or Fish unless there are really good reasons to use them. This choice not only ensures your script will work virtually everywhere, but also fosters comprehension of a script by the whole team. You don't write production scripts for yourself.

### Use Bashisms

If you use Bash, don't half-use it. Use [parameter expansion](https://www.gnu.org/software/bash/manual/html_node/Shell-Parameter-Expansion.html). Use [local](http://tldp.org/LDP/abs/html/localvar.html) and [readonly](https://ss64.com/bash/readonly.html) variables. Use [improved conditional expressions](https://www.gnu.org/software/bash/manual/html_node/Bash-Conditional-Expressions.html).

### Quote your variables

Even if you know quoting is not required, it's a good habit to always quote variables. The only exception is when you specifically want expansion to occur. More on [word splitting](https://github.com/koalaman/shellcheck/wiki/SC2086).

### Name your parameters

This goes without saying, but explicitly naming parameters (`$1`, `$2`, ...) makes the code self-documenting and helps readability. The parameter expansion of Bash is a great candidate for naming and assigning default values to positional parameters:

```bash
my_arg=${1:-default}
```

### Use subshells as a way to control what's in your global scope

An example is worth a thousand words:

```bash
var=1
echo $var
(
    echo $var
    var=5
    echo $var
)
echo $var
```
will print:

```
1
1
5
1
```

My main usage for this is when I need to temporarily modify `$IFS` (for iterating over simple CSV-like files for example) and reset it to its original value afterwards.

### Use a template

This script template summarizes every snippets shared along this article. I believe it's a good basis for any kind of script.

```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

#/ Usage:
#/ Description:
#/ Examples:
#/ Options:
#/   --help: Display this help message
usage() { grep '^#/' "$0" | cut -c4- ; exit 0 ; }
expr "$*" : ".*--help" > /dev/null && usage

readonly LOG_FILE="/tmp/$(basename "$0").log"
info()    { echo "[INFO]    $*" | tee -a "$LOG_FILE" >&2 ; }
warning() { echo "[WARNING] $*" | tee -a "$LOG_FILE" >&2 ; }
error()   { echo "[ERROR]   $*" | tee -a "$LOG_FILE" >&2 ; }
fatal()   { echo "[FATAL]   $*" | tee -a "$LOG_FILE" >&2 ; exit 1 ; }

cleanup() {
    # Remove temporary files
    # Restart services
    # ...
}

if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then
    trap cleanup EXIT
    # Script goes here
    # ...
fi
```

### Stay informed

Shell scripting isn't moving that much these days. It's a great reason to read stuff about the topic, it makes it easy to keep up! Here are some interesting resources:

* `man bash`, I bet almost none of you have read it, yet it's a great source of information! And it's not that hard to read, I promise.
* [@UnixTooltip](https://twitter.com/UnixToolTip) on Twitter, continuously gives tips and tricks.
* [Most upvoted Bash questions on StackOverflow](https://stackoverflow.com/questions/tagged/bash?sort=votes&pageSize=15)
* [Bash participative documentation on StackOverflow](https://stackoverflow.com/documentation/bash/topics) has some interesting examples.
* [ShellCheck's wiki](https://github.com/koalaman/shellcheck/wiki) is a good resource to learn what not to do, and why.
* [Hacker News](https://news.ycombinator.com/news) and [/r/programming](https://www.reddit.com/r/programming/), once in a while articles on this subject pop out.

- - -

I hope this article brought light on what was possible with shell scripting. The tools are there. You know the practices. Now it's up to you to make scripting a delight to work with, for you and your team!
