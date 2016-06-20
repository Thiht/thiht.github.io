---
layout: post
title:  "Learn to use screen, a terminal multiplexer"
date:   2015-12-04 19:00:00 +0100
---

[screen](https://www.gnu.org/software/screen/), or GNU screen, is a terminal multiplexer. It allows to manage multiple terminal sessions within the same console. In a way, it does the same thing as modern terminal emulators such as [Terminator](https://gnometerminator.blogspot.fr/p/introduction.html) or [Terminology](https://www.enlightenment.org/about-terminology) with their built-in tab system and layout management. The main benefit is that screen also works through an SSH connection: you will be able to use your screen knowledge and configuration on any machine supporting screen in the world!

screen has been around for almost 30 years so it's pretty stable now. It is released under the GPL license.

The main issue I had when starting with screen was its relative difficulty when compared to simple terminal emulators. So **I will make a tour of the most useful keyboard shortcuts for a practical use**, and share with you my screen config. You can also jump directly to the [cheatsheet](#cheatsheet-of-the-main-commands) if you want.

## Basic usage

screen is not installed by default, so you need to install it first using your package manager.

To **start screen**, open a terminal and run the command `screen`. Not that hard, is it?

We're ready to start learning screen. Don't worry, that's only a few commands!

### Window management

Now you have opened screen, the first thing you need to know is how to **create a new "window"** (i.e. a new virtual terminal). To do so, press the keys `Ctrl+a`, and then press `c`. The screen shortcuts all consist of `Ctrl+a` (called "escape key" or "prefix") followed by another key. You now have two windows opened running in parallel, you can have vim in the first one, and a bash in the second one for example, and that's what screen is all about.

You can **visualize all the opened windows** with `Ctrl+a` `"`. This view allows you to navigate through your windows with the arrow keys, the 0-9 numbers and the enter key. This command is great because it gives you a global overview of your current session, I used it a lot at first.

But there are more ways to **navigate through the windows**! I personally use almost exclusively the commands `Ctrl+a` `p` (**p**revious window) and  `Ctrl + a` `n` (**n**ext window). These shortcuts require to have your windows in mind though, but it comes with practice. And don't forget `Ctrl+a` `"` is here to rescue you in case of doubt. ;)

It's also possible to jump to another window with the command `Ctrl+a` *`number`*, where *number* is a number between 0 and 9. This matches the "Num" column of the `Ctrl+a` `"` view.

Finally, you can **kill a window** when you have no use for it anymore. To do so, just press `Ctrl+d` in the shell. There's also a screen command with the "same" effect but it's usually better to proceed this way. Note if you kill all the windows of a session, the session terminates.

- - -

Summary:

* `Ctrl+a` `c` to create a new window
* `Ctrl+a` `"` to visualize the opened windows
* `Ctrl+a` `p` and `Ctrl+a` `n` to switch with the previous/next window
* `Ctrl+a` *`number`* to switch to the window *number*
* `Ctrl+d` to kill a window

### Session management

Now you can manage your windows, it is time you learn how to manage your screen sessions.

You just learned you can terminate a session by killing all its windows, that's a good start. We will now see how to **exit a session without killing it**. It means you'll be able to manage multiple persistent sessions in parallel. This is called "detaching" a session. To be clear, a **detached session** is a session which is still active in background, but on which no one is connected. An **attached session** is a session which is active and currently used.

The first thing I'll ask you to do is to kill your current screen session if you haven't done it already. You can then **list all your screen sessions** by running the command `screen -ls`. If all your sessions are closed, it should print something like:

    No Sockets found in /var/run/screen/S-thiht.

Now, we'll start a **new session**, but **we'll give it a name** so that we can come back to it more easily later. Run the command `screen -S my_session`. If you run the command `screen -ls`, you should obtain something like:

    There is a screen on:
        10321.my_session        (Attached)
    1 Socket in /var/run/screen/S-thiht.

Since you're connected to the session, it's presented as **attached**.

Now you're connected to a session named "my_session", you can **detach it from the current terminal** with the command `Ctrl+a` `d`. This should result in a message like:

    [detached from 10321.my_session]

As usual, you can list the currently running sessions with `screen -ls`. This time, "my_session" should be listed as **detached**:

    There is a screen on:
        10321.my_session        (Detached)
    1 Socket in /var/run/screen/S-thiht.

I suggest you start and detach a few screen sessions to understand how it works. **Be careful not to use the same session name twice**, screen allows it but it can be more painful to resume a session if there are name conflicts.

With multiple screen sessions, the `screen -ls` gives something like:

    There are screens on:
        10474.downloads (Detached)
        10427.work      (Detached)
        10321.my_session        (Detached)
    3 Sockets in /var/run/screen/S-thiht.

If there aren't any conflicts, you can **resume a session** simply with the command `screen -x session_name`. So for example if you run `screen -x my_session`, your session "my_session" will be resumed with the windows you opened before! And if you run `screen -ls`, it should appear as **attached**:

    There are screens on:
        10474.downloads (Detached)
        10427.work      (Detached)
        10321.my_session        (Attached)
    3 Sockets in /var/run/screen/S-thiht.

A last useful thing you should know is how to **kill a detached session without connecting to it**. To do so, the command to run is a bit tricky: `screen -S session_name -X quit`. This means you pass the command "quit" to the session named "session_name". It's a bit hard to remember so I generally simply resume my session and kill all its windows one by one.

- - -

Summary:

* `screen -ls` to list the sessions and their status
* `screen -S session_name` to start a session with a given name. The name
should be unique
* `Ctrl+a` `d` to detach a session
* `screen -x session_name` to resume (reattach) a session knowing its name
* `screen -S session_name -X quit` to terminate a detached session

## Advanced usage

The hardest part is over! You have discovered screen and you know how to use it. All you need now is practice.

In this section, I'll present a few interesting features of screen, but they're definitely not necessary to use it, so feel free to come back and read this part later.

### Layout management

In the introduction, I talked about how Terminator and Terminology can work as layout managers. The good news is screen also permits to do that. So to **split horizontally**, you can use the command `Ctrl+a` `S`, and to **split vertically** you can use `Ctrl+a` `|`.

To **switch to the next region** (this is how the split panes are called), the command to use is `Ctrl+a` `<Tab>`. Each region behaves normally: you can run any command you have learned so far.

To **close the current region**, use `Ctrl+a` `X`. If you work with a lot of panes, you can **close them all but the current one** with `Ctrl+a` `Q`.

- - -

Summary:

* `Ctrl+a` `S` to split horizontally
* `Ctrl+a` `|` to split vertically
* `Ctrl+a` `<Tab>` to switch to the next region
* `Ctrl+a` `X` to close the current region
* `Ctrl+a` `Q` to close all the regions but the current one

### Work with the buffer

To follow, I'll talk about an important feature of screen: the copy mode, or scrollback mode.

To **enter the copy mode**, the command is either `Ctrl+a` `<Esc>` or `Ctrl+a` `[`, choose your side. The copy mode allows you to **navigate through the console buffer without using your mouse**. Since you can't use your wheel to scroll by default, this is the normal way to go back in the results. This mode lets you use some vim commands for the movements (arrow keys, `0`, `$`, `g`, `G`, etc.).

You can **copy some text** (that's what the mode is for!) by marking the beginning and the end of a section with the space bar. You can then **paste it** with `Ctrl+a` `]`.  For more informations, check the `man screen` and look for "copy".

- - -

Summary:

* `Ctrl+a` `<Esc>` or `Ctrl+a` `[` to enter in copy mode
* `<Space>` to select and copy some text in copy mode
* `Ctrl+a` `]` to paste the content of the buffer

### Session sharing

I'll finish with a last screen feature I want you to know about: it allows to share a session between multiple users. When working on a remote server, this comes really handy.

So first, you have to start a session as usual. Then, we'll use the command mode of screen to enable the multiuser mode and give the access right to some users. To **enter the command mode**, type `Ctrl+a` `:`. You can then **enable the multiuser mode** with the command **multiuser on**.

Then to **add a specific user to the session**, enter the command mode again with `Ctrl+a` `:` and type the command **acladd *username*** (ACL stands for "Access Control List") with the name of the user you want to add instead of *username*.

The user *username* is now able to **join your session** simply with the command `screen -x your_username/session_name`. The session is completely shared, which means you can see what the other users do in real time and so can they.

When a session is shared with multiple users, it can be nice to **know who is currently connected on it**. You can have this info and more thanks to the command `Ctrl+a` `*`. The view shows a few useful informations, namely the window a user is currently using, or their permissions.

Finally, you can **revoke the access rights of user** with the command **acldel *username*** in command mode. There's more you can do to manage a shared session, but I won't go into details, the man page covers everything. Now you have a basic understanding of screen, it should be easier to understand.

- - -

Summary:

* `Ctrl+a` `:` to switch to command mode
    * "multiuser on" to enable the multiuser mode
    * "acladd *username*" to give the access rights to the user *username*
    * "acldel *username*" to remove the access rights to the user *username*
* `screen -x owner/session_name` to join a session started by another user
* `Ctrl+a` `*` to list the other connections to a session

## Practical tips

### Automatically list the screen sessions

When I start my terminal, I like it to list the current screen sessions. To do so, I simply added the `screen -ls` command to my .bashrc. So now whenever I open a terminal, I'm welcomed with my screen status:

    There are screens on:
        2927.my_screen3 (Attached)
        2882.my_screen2 (Attached)
        2840.my_screen1 (Detached)
    3 Sockets in /var/run/screen/S-thiht.

Not only is it really useful to have this status without asking for it, but it is also a good way to think about always using screen.

### Good aliases

As you're now aware, screen uses a lot of options. I tried to keep only the most useful in this article but they're still a pain to remember. A good way to remember them is to use aliases. I personally use the following:

    alias sn='screen -S'  # sn for screen new
    alias sl='screen -ls' # sl for screen list
    alias sr='screen -x'  # sr for screen resume
    function sk() {
        # sk for screen kill
        # function instead of alias because the order of the parameters matters
        screen -S "$1" -X quit
    }

These aliases don't conflict with anything standard and they're really easier to remember and to type, so I strongly advise you to use them!

### Custom configuration

screen can be customized in various ways through a .screenrc file, located in your home folder. One of the most useful tricks is the status bar.

![screen session with a status bar](https://i.imgur.com/ZYEdvln.png)

I won't go through the configuration of screen in details (you can read `man screen` or other articles to learn more), but simply share my commented .screenrc with you:

<script src="https://gist.github.com/Thiht/36a3dac4b6afdab04d76.js"></script>

Note you can enable any of these options directly from screen's command mode.

### Cheatsheet of the main commands

#### Basic usage

| Command                          | Description                                 |
|----------------------------------|---------------------------------------------|
| `screen`                         | Start a session                             |
| `screen -ls `                    | **L**i**s**t the sessions and their status  |
| `screen -S session_name`         | **S**tart a session named "session_name"    |
| `screen -x session_name`         | Resume the session named "session_name" |
| `screen -S session_name -X quit` | Terminate the session named "session_name"  |

| Command          | Description                            |
|------------------|----------------------------------------|
| `Ctrl+a` `c`     | **C**reate a new window                |
| `Ctrl+a` `k`     | **K**ill the current window ([`Ctrl+d`](https://en.wikipedia.org/wiki/End-of-transmission_character) does the same thing) |
| `Ctrl+a` `"`     | List the opened windows                |
| `Ctrl+a` `p`/`n` | Go to the **p**revious/**n**ext window |
| `Ctrl+a` `0`-`9` | Go to the window *n*                   |
| `Ctrl+a` `d`     | **D**etach the screen session          |
| `Ctrl+a` `:`     | Enter the command mode                 |

#### Split mode

| Command          | Action                                    |
|------------------|-------------------------------------------|
| `Ctrl+a` `S`     | **S**plit horizontally                    |
| `Ctrl+a` `|`     | Split vertically                          |
| `Ctrl+a` `<Tab>` | Go to the next region                     |
| `Ctrl+a` `X`     | Close the current region                  |
| `Ctrl+a` `Q`     | Close all the regions but the current one |

#### Copy mode

| Command              | Action                          |
|----------------------|---------------------------------|
| `Ctrl+a` `<Esc>`/`[` | Enter the copy mode             |
| `<Space>`            | Mark a selection                |
| `Ctrl+a` `]`         | Paste the content of the buffer |

#### Shared session

| Command                        | Action                                    |
|--------------------------------|-------------------------------------------|
| `Ctrl+a` `:` `multiuser on`    | Enable the multiuser mode                 |
| `Ctrl+a` `:` `acladd username` | Give the access rights to *username*      |
| `Ctrl+a` `:` `acldel username` | Revoke the access rights to *username*    |
| `Ctrl+a` `*`                   | List the other connections to the session |
| `screen -x owner/session_name` | Join a session started by another user    |

## Conclusion

screen is a powerful tool if you use the terminal a lot. Yet, it has some drawbacks, that can be pretty annoying. To list a few you **will** be confronted to if you really try to use it:

* bad UTF-8 support. There are a few configurations to make screen work fine with unicode, but it's still a bit messy. I am not even sure there is a proper way to handle UTF-8 characters in the status bar...
* insane status bar configuration. You can see it in the .screenrc I provided, crafting a neat status bar is really hard. It's a shame given how useful they are!

Good news though, all these issues are allegedly solved with [tmux](https://tmux.github.io/), another more recent terminal mutiplexer. I've only used it as a replacement of screen for a few days so I will wait a bit before reviewing it, but it's very similar to screen in its usage, and I'm very satisfied with it so far.
