<div align="justify">

# SOS Postmortem

After the theme for the 2021 js13k competition was announced as "Space" I came up with the idea of creating a top down civilization type game where the goal would be to advance from the stone age, through to the space age, and achieve space travel.

I had spent some time (before the competition began) evaluating candidate game engines to use for my entry but after they all came up short in one way or another, I decided to write my own 2D game engine in JavaScript.

About a week into the competition I had a pretty solid start on my engine but it was soon obvious that the large scope and size of a full feature game engine would not work with the js13k size limits. From this point on I just mashed the appropriate parts of the engine into my main code-base.

Around the middle of week 2 I had designed the majority of my game and had created some code to procedurally generate circular game worlds using [cellular Automaton](https://en.wikipedia.org/wiki/Cellular_automaton) and [bit-masking](https://web.archive.org/web/20110714085421/http://www.angryfishstudios.com/2011/04/adventures-in-bitmasking/). After I began implementing mechanics and so forth it dawned on me that there was no way I would be able to cram all of the graphical assets required for such a game into a 13Kb zip file, even with on the fly recoloring of imagery inside the game.

Some more deep thinking took place (okay, a brain fart or two) and I decided that I'd just take the easy road and create a pixel-art space themed shoot-em-up. After spending a few days gathering and creating assets, defining requirements, and designing mechanics, I decided that it was feasible to proceed.

My list of requirements for SOS were:

- Colorful pixel-art.
- Actors.
- Object pooling.
- Robust graphical user interface.
- Basic particle effects.
- Procedurally generated backgrounds.
- Parallax stars.
- Shadows for the player and enemies.
- Sound effects.
- Increasing difficulty level, maxing out at a certain point.
- Multiple enemies with simple AI.
- Persistent high scores.
- Persistent configurable options.

So how did I do? Good question. Let's find out.

<br>

## Colorful pixel-art

Earlier in the week I had been messing about with recoloring images using `getImageData()` and `putImageData()` and I spent a few days getting that code into shape and integrated in the main code-base. It really ended up working so much better than I expected, and it was around this time that I also got the mad idea to basically render a large logo for the game using canvas line drawing and gradient fills. Once implemented, it was really spectacular, and comparing the code required vs having an actual image for the logo, it shaved 1601 bytes from the final zip file!

The asset generation code basically takes this image...

![Base Assets](postmortem/assets_base.png)

And uses it to create this image...

![Composed Assets](postmortem/assets_composed.png)

NOTE: The images above have a grey background just to make them stand out from githubs white background.

So how did I get from the first image to the second image? That's a very good question, and one I'll attempt to answer in a half coherent manner.

At first glance it looks like the first image is a solid black image but it is in fact an 8 color indexed PNG file drawn in 7 shades of blue (#000001 - #000006).

Using `ctx.getImageData(x, y, w, h)`, you can get an array of bytes containing all of the pixel information for a defined rectangle inside a context.

These bytes can then have their red, green, and blue values remapped using indexed color palettes, and then written back to the same context using `ctx.putImageData(imageData, x, y)`.

As I experimented with this it was annoying that I kept getting errors relating to `tainted canvases`, a really frustrating cross-origin web browser security feature.

Fortunately I discovered that if an image is embedded directly into an HTML file as a [data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs), canvasses are no longer considered tainted when using `getImageData()` and `putImageData()`. It was also pleasantly suprising to find that my MIME encoded image (encoded using [Base64 Image](https://www.base64-image.de)) produced a smaller zip file than when I had the image stored as a normal PNG file. Go figure.

All graphical assets in SOS are stored in one large image called a `Texture Atlas`. There is an array of `Texture Regions` that define bounds of sub-images contained within the atlas.

Originally, `Texture Regions` (and a lot of other things) were stored inside associative arrays so that they could easily be referenced by their names. Because Closure Compiler botches up associative arrays totally, I had to switch to hard-coded indexes, which really made things a lot harder to maintain.

As the final `Texture Atlas` is generated, extra `Texture Regions` are created on the fly. This saved a load of bytes in the final zip file size but again, makes the code that much harder for others to read.
## Actors

For my 2D game engine I created an `Actor` class which had getters, setters, and all manner of other functionality. The code was way too big to be included in the SOS code-base so I just kept the parts that I needed.

Both Closure Compiler and UglifyJS would not mangle object properties correctly, so I found that I had to abbreviate many of the actors properties, making the code all that much harder to read (for the unfamiliar reader).

The `Actor` became just an object, with all the class code removed. In this state it became the "thing" that was used for everything (player, enemies, bullets, particles, buttons, etc). It was actually a very versitile "thing" in the end.

<!-- Actors are created by calling `getActor(role)` where role is one of the following..
```javascript
ROLE_NONE         = 0, // Player does not collide with actors with the following roles
ROLE_IMAGE        = 1,
ROLE_TEXTFIELD    = 2,
ROLE_BUTTON       = 3,
ROLE_PARTICLE     = 4,
ROLE_PLAYER       = 5, // Player does not collide with its self
ROLE_BULLET       = 6, // Or its own projectiles
ROLE_CITIZEN      = 7, // Player collides with all actors with the following roles
ROLE_ENEMY        = 8,
``` -->

<br>

## Object pooling

Object pools are pretty basic things and my implementation is a bog standard type of pool where you specify an initial capicity at initialization, and then it grows as required. During testing I never saw it grow from its initial capacity of 1024.

Right at the end of development (around 2 hours before submissions closed) I discovered an issue relating to resetting the pool. Whilst I could have resolved it given more time, I decided to just change the `resetPool()` function to empty and recreate the pool when called. This is generally not how a pool of objects behaves but it only happens when nothing else is happening in the program so there is really no performance hit that the player can notice.

<br>

## Robust graphical user interface

My game engine ended up including a very robust user interface management module. Of course due to js13k constraints the entire thing could not be used so I hacked and chopped it down to its bare minimum functionality for SOS.

The requirement to ditch functionality actually was a good thing as the user interface elements just became actors with roles apropriate to their purpose (ROLE_BUTTON, ROLE_TEXTFIELD, and ROLE_IMAGE). These roles were sufficient to enable me to represent all of the required user interface elements in SOS.

<!-- 
**Buttons** are a fixed height and variabe width. They are rendered using a 3-patch image into a new canvas which is stored and used when drawing them to the game scene.

**TextFields** are also a fixed height and have variable width. They are rendered into their own canvas using a bitmap font, which is then used when drawing them to the game scene.

**Images** take their imagery from the main atlas. -->

<br>

## Basic particle effects

When it came to creating a particle system I knew that I would have to choose carefully which functionality to include. I eventually came up with the following minimal characteristics that all particles should have..

- A decrementing TTL (Time To Live) counter. Once this  is equal or less than zero, the particle is removed from the scene.
- Are represented  by an image which  can be animated over time, enabling  the particle system to be used for one-shot animations such as explosions, etc.
- Can be positioned.
- Can move over time at a set speed.
- Can shrink (scale 1 to 0).
- Can alpha fade (alpha 1 to 0).
- Can rotate (0 - 360).
- Can be z-ordered.

Eventually I fabricated some code that met all of my requirements in roughly 30 lines of JavaScript code. I consider this very good code and was really pleased that I managed to get animation over time implemented.

<br>

## Procedurally generated backgrounds

As mentioned previously, I already had all of the code required for this functionality created whilst working on the abandoned civilization prototype.

Given more time I would have added some code to recolor the background tile-set between attack waves, but I was bogged down on the final day bug hunting and madly trying to get some other crucial features implemented.

<br>

## Parallax stars
All up I managed to create a 3 layer parallax starfield which doesn't need any depth srting in about 25 lines of JavaScript code. This is one of several bits of code that I'm most proud of creating for SOS.

When menus are visible `(BUTTONS.length > 0)` the stars are static and change color at random. This could have been made better given time to create better palettes.

When the game is in the playing state, the stars parallax scroll according to the players velocities.

<br>

## Shadows for the player and enemies

Shadows didn't turn out to be as tricky to make work as I initially thought. Because my base assets are very dark, they could be used directly to draw shadows for specific actors (the player, and enemies).

Shadows are always drawn for the player and enemies. Because the background is very dark and the stars very small, you really don't notice that the player and enemies are actually casting shadows on the stars.

<br>

## Sound effects

I used Frank Force's awesome [ZzFX](https://killedbyapixel.github.io/ZzFX/) to create the sound effects for SOS. This part of the SOS code-base is a heavily modified version of zzfx.js, part of ZzFX.

The code comes from the module I made for my 2D game engine and once again the associative arrays had to be modified to use indexes.

Given more time (I should have that as a t-shirt logo) I would have tweaked the sound effects more, and added a few more as well.

<br>

## Increasing difficulty level, maxing out at a certain point

Difficulty scaling uses a simple quadratic easing algorithm, scaling enemy attributes from 0.5 to 1 over 10 waves, whereon all enemies are at their most dangerous.

Scaled enemy attributes are their maximum movement speed, targeting range, and reloading duration.

Aggressors do not have their attributes scaled, as they are designed to be deadly all the time.

<br>

## Multiple enemies with simple AI

I designed seven different enemies for SOS, the Scout, Roamer, Bomber, Mine, Carrier, Swarmer, and Aggressor.

 <table>
  <tr>
    <th>Enemy</th>
    <th>Image</th>
    <th>AI</th>
  </tr>

  <tr>
    <td>Scout</td>
    <td><img src="postmortem/scout.png"></td>
    <td>Scouts orbit the center of the game world at distances near the edge of the generated background. Scouts fire photons at the player when it is in range.</td>
  </tr>

  <tr>
    <td>Roamer</td>
    <td><img src="postmortem/roamer.png"></td>
    <td>Roamers rotate as they move and just bounce around the game world in radom directions. When the player is in range, roamers fire muons in a random direction.</td>
  </tr>

  <tr>
    <td>Bomber</td>
    <td><img src="postmortem/bomber.png"></td>
    <td>Bombers move between two generated waypoints. As they move, bombers randomly spawn mines.</td>
  </tr>

  <tr>
    <td>Mine</td>
    <td><img src="postmortem/mine.png"></td>
    <td>Mines are spawned by bombers. They begin moving in a random direction and slow quickly to become stationary. After 10 seconds they self detonate.</td>
  </tr>

  <tr>
    <td>Carrier</td>
    <td><img src="postmortem/carrier.png"></td>
    <td>Carriers move very slowly towards the player. When the player is in range, and when the carrier is directly facing the player, cariers begin rapidly firing salvos of comets at the player. When a carrier is destroyed it releases a swarm.</td>
  </tr>

  <tr>
    <td>Swarmer</td>
    <td><img src="postmortem/swarmer.png"></td>
    <td>Swarmers are spawned when carriers are destroyed. They home on the player quickly and are suicidalin their nature.</td>
  </tr>
  <tr>
    <td>Aggressor</td>
    <td><img src="postmortem/aggressor.png"></td>
    <td>After one minute, Aggressors begin spawning every 5 seconds. Aggressors home on random positions around the player and fire missiles at the player when it is in range.</td>
  </tr>

</table> 


Individually their AI is very simple, but when combined they present an interesting combat dynamic for the player.

Overall I was very happy with the enemies, especially how they combine to wreck the player at higher difficulty settings.

<br>

## Persistent high scores

I was happy with the high score system I came up with, but it would have been better to maybe make the scores larger on the high score menu and also add some effects like twinkling or something (a bit like the logo has on the main menu).

The high scores are saved to local storage as com.antix.sos.s.

<br>

## Persistent configurable options

Due to a little incompetence, this proved to be really difficult and in the end the code had some extraneous data in it.

Since it was the final day of the competition and since I was well under the 13Kb limit, I wasn't overly worried about optimizing it. I was also quite busy bug hunting and play testing.

From the options menu the player can enable and disable sound effects, and remap the controls. They can also reset the options to their defaults.

The options are saved to local storage as com.antix.sos.o.

<br>

# Final thoughts

Participating in the js13k competition has been challenging and rewarding, and has really made me a better programmer (I think). I'm already looking forward to next years competition where I hope to create something even better than I managed to this time round.

Having to rethink many different aspects of the project was a good learning experience and I am sure that I will look at future programming problems from a different angle from now on.

Overall I'm very pleased with what I managed to accomplish in one month on my own. Somehow I managed to produce most of a 2D game engine, half a civilization type game prototype, and a full feature shoot-em-up.

Given more time (my new catch-phrase) I would..

- Improve the particle system to include emitters, be able to fade in and scale in, and have gravity effects.

- Tweak the enemy attributes and difficulty scaling.

- Improve citizen placement so they aren't so "clumpy".

- Tweak existing sound effects and add new ones, especially for highscore achievement.

- Add a few more visual effects like smoke trails for missiles and the like.

- Implement some really cheap and nasty procedurally generated music.

- Improve the background generator to use 8-bit bit-masking if the 13Kb size limit wouldn't be exceeded.

- Generate a wider variety of 3-patch buttons.

- Enhance the `textField` actor to handle scaled rendering and possibly multiple lines.

- Add a one pixel padding to all graphics so they don't get little edge artifacts when drawn rotated (did you notice they do that?).

Anyhoo, thanks for reading my postmortem and I hope that you can decipher a bit of my code and will maybe learn something new that you can leverage in your own projects.

As always, I'm more than happy to try and explain anything you can't grasp, or where the code is just unreadable. In any case just drop me a line on antix.develpment@gmail.com

</div>
