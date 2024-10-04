HTTP Configurable Mock Server
===

We used to use Mountebank for automation, it is being deprecated so we need a different solution.  This repo is designed
to build something we can use in place of Mountebank with zero external dependencies.

What's 0.0.1 good for?
---

This version is good enough to pass the Cypress tests in `pay-selfservice`.  It's also passing 56% of the Cypress tests
for `pay-frontend`.  That's with minimal code changes in each repo - just pointing to different ports and a change to
the `cypress:server` npm script.

What's the plan for the future?
---

I (Natalie) would like to see this used in the short term as a drop-in replacement for Mountebank across our codebases,
once that's done I'd like to take a look at what's helpful and unhelpful about the Mountebank approach and to turn this
into a tool that works in a more helpful way for us, that will require codebase changes in the projects that use it.

What would you change if you could?
---

There are a few things I've learned while going through this exercise, they don't all need changing but I think it's
worth discussing them in more detail.  Here's a little list as a starter:

### Response arrays

So when you come across a tool which allows an array of responses what would you assume happens when you just provide
one? I would personally assume that it will respond once in that configured way and then go back to the default
response, that's not what happens.  This one response will be given every time a matching request comes in.

OK, so that can be a logical way of handling one response but it's an array - what happens if I add a second one?
Adding a second response means that Mountebank (and this tool as it stands today) will alternate between those two
responses.  That means that if something happens like a request is retried in the background the test will behave
differently.

### Default responses

What would happen if you only set up one endpoint like `/a`, then you make a request to a different endpoint like `/b`?

The response from `/b` will be an empty `200` ... that's a strange default.  Defaults can be overridden in Montebank
(and this tool) but it seems strange to me that the default isn't a `404` like a 'normal' web server would give.