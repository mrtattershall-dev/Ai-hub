<div align="justify">

# SOS

<p align="center"><img src="postmortem/screenshot.png"></p>

<br>

SOS is my submission the 2021 [js13kGames](https://js13kgames.com) competition, where over a one month period you create a game based on a theme ("space" for 2021), and then you cram your entire game (code and assets) into a 13Kb zip file and submit it.

You can play SOS on [its js13k competition page](https://js13kgames.com/entries/sos), or download and load index.html from this repository.

## Introduction

SOS is a retro shoot-em-up game using pixel art graphics, written in JavaScript, HTML, and CSS.

<br>

## Gameplay

The goal in SOS is to complete successive attack waves by rescuing a number of marooned space engineers, whilst avoiding and/or destroying the enemy units that are present in the wave.

Attack waves become increasingly difficult and at wave 10 the game is at its most difficult. I acknowledge that the balance could be much better tuned but hey.. I only had a month!

<br>

## Features

In my opinion, some of the more note-worthy features of SOS are...

- An asset generator which takes an 8-color indexed PNG file which is then copied, pasted, and has it's colors remapped to create a fairly large texture atlas.

- A rendered 2D logo?

- A multi layered self depth sorting parallax starfield in 20 lines of code.

- A particle system featuring movement, scaling, fading, and animation, all in maybe 50 lines of code.

- Seven different enemies with basic AI which combined, present a quite complex combat scenario.

- An entire SHMUP game shoe-horned into a 13Kb zip file!

The features above might be pedestrian to you, but they are the ultimate expression of my feeble programming abilities.

<br>

## Technologies

SOS was developed using Visual Studio Code and Notepad++.

All Assets were created using GIMP, and Frank Force's fantastic [ZzFX](https://killedbyapixel.github.io/ZzFX/).

Base graphical assets were both sourced from [Open Game Art](https://opengameart.org/), and created by myself.

[Base64 Image](https://www.base64-image.de) was used to convert the PNG file to a data URI that was able to be embedded inside index.html. Base64 encoding actually ended up better (zipfile size-wise) than using a PNG file, and also resolved "canvas poisoning" issues.

[UglifyJS](https://github.com/mishoo/UglifyJS) was used to minify the JavaScript code and I was supprised to discover that it consistently out-performed Google's Closure Compiler.

<br>

## The Code

First and foremost I must humbly apologize for the state of the SOS code-base. Due to the limitations imposed by the js13k competition, it became kind of messy and not very easy to read quite quickly.

On the plus side, I'm always more than happy to answer any questions you might have regarding the code, just drop me a line at antix.development@gmail.com :)

<br>

### BE AWARE...
**The main code-base contains a few small features (bugs if you must) that do not prevent the game from working, but exist in any case.**

**The extended code-base found in "src/after js13k/" has all issues resolved and also includes added functionality. The main code-base is left purely for js13k competition requirements.**

</div>