+++
title = "TDD is a personal practice"
description = "TDD should not be a mandated practice in a team. Doing TDD is not a goal in itself."
date = 2023-12-18

[taxonomies]
tags = ["testing", "rant"]
+++


I know TDD. I know what real TDD is. I know how to do it right, whatever that means depending on the TDD practitioner.
I still don’t like this practice, and rarely use it, except in 2 situations:

1. I’m fixing a bug in an existing code base: in this case I’ll write a test first to reproduce and isolate the bug, and then fix it and refactor if needed
2. I’m adding a new use case to an existing feature, and will treat the lack of existence of this new case as a bug, see 1.

I don’t ever, ever, EVER use TDD to write new features from scratch. It doesn’t work for me. It doesn’t match my mental model. It doesn’t help me go faster, doesn’t make me produce better code, and doesn’t make me write more, or more useful tests. I don't enjoy it and it doesn't provide me with any kind of satisfaction.

I still have a personal methodology, but it’s not TDD. I still strive to write good test and maintain good coverage, but not doing TDD.

TDD should not be forced upon developers who don’t want to follow it, in the same way a specific IDE should not be forced upon a developer. TDD is a tool, not a goal in itself. The shared goal is to have a well tested code base that is as safe as possible from regressions. How developers achieve that doesn’t matter.

TDD should not be conflated as "writing tests". I often see the rhetoric that, if you don’t do TDD, then you don’t write tests. If I showed you a code base with tests, there would be no way for you to know if they’ve been written in TDD or not.

TDD is not a team practice. Writing tests is a team practice. Code review is a team practice. Automated CI is a team practice. Whether a developer does or does not do TDD has no impact on the rest of the team. I could tell you I'm doing TDD if it pleases you, and you'd have no way to know that I don't, micro-managing set aside.

If in TDD you trust, don’t proselytize it. TDD is a personal practice.
