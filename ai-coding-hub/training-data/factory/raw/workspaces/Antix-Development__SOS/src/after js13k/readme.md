# SOS - Extended code
<div align="justify">

After the js13k competition ended, I messed about with the code some more.

**13/9/2021**

- Basic debug out can be toggled with the "o" key. When debugging is enabled onscreen enemies have circles drawn to show their collision radius (`actor.cR`), targeting range (`actor.range`), and a line pointing to whichever other actor they might be targeting (``actor.T`).

- Tried minifying even more using RoadRoller, and JSCrush but both caused issues when running the game.

- Actor now has a dedicated target attribute (`actor.T`). This makes it easier to manage which other actor any particular actor might be targeting.

- `home()` was renamed to `seek()` which is a more appropriate name. `seek()` now takes jut one parameter `actor` to correspond with the actor now having a dedicated target attribute.

- Discovered a bug when the player dies ( *Uncaught TypeError: Cannot read properties of undefined (reading 'n') at keyUp (sos.js:2274)*). The issue was caused by `enteringName` being set to true at the wrong place in the code so 'keyUp()' throws a console error. Set `enteringName` to `false` when initiating a new game which resolved it.

These fixes and additions take the zip file up to 13,227 bytes, not far from the maximum allowed for js13k. I'll try to manually mangle some object attributes and see if I can;t get that size down a l,ittle.

After minifying with Terser, I ran the code through RoadRoller. Whilst the game was fine in FireFox, The UI elements flickered a few times in Chrome before disappearing totally. That's a shame because when zipped the whole thing is only 11,886 bytes.

It might be worth investigating whay it fails so terribly in Chrome as I think I could do quite a lot with an extra 1426 bytes ;)

**14/9/2021**

- Replaced all `false` and `true` occurrences with 0's and 1's.

- Replaced the actors single `iR` (imageRadius) variable with `rX` (radiusX) and `rY` (radiusY) to better accomodate rectangular images.

- I've now decided to now shelve SOS and work on my 2D gaming engine since there is no requirement to be creating tiny code for now. I'm really looking forward to js13k competition 2022 however, see you all there!


**16/9/2021**

- On the flight back from Rarotonga to New Zealand I played many games of SOS, and to music. During this time I thought that it might be good if the game was overall more difficult to begin with, had more enemies to blast, and had some more effects when destroying enemies.

**19/9/2021**

- Doubled the number of enemies spawned in every wave.

- Discovered a miscalculation in the difficulty scaling in `upscaleAttribute()` where the range was between 50% and 150%, instead of 50% to 100% (whoops).

- Changed difficulty scaling so enemies scale between 60% and 100% of their maximum difficulty over time.

- Aggressors are now slightly more aggressive!

- Took a random small explosion frame and created 10 rainbow colored versions (like the font) which are now used as extra particles when enemies are destroyed.

- Missiles fired by the Aggressor now have trails.

- Discovered that the following two conditional blocks of code are basically the same... but the second one is less code, so I replaced them all with the smaller versions.
````JavaScript
	counter -= DT;
	if (counter < 0) {
		// execute code
	);

    // Same but using less code
	if ((counter -= DT) < 0) {
		// execute code
	);

````
- All of the above takes the final zip file to 13,302 bytes, still within js13k limits... by 10 bytes!

- I am still wondering if I can get SOS working in Chrome when using Roadroller, as currently SOS only works correctly in Firefox after being road-rolled.

**20/9/2021**

- Moved `remap()` outside of `generateAssets()` so that it can be called to recolor the background tileset.

- Added code in `generateBackground()` to recolor the background tiles using a random Hue, set saturation, and set ligntness.

- Changed all occurences of `null` and `false` to `0`, and `true` to `1` since `true/false` checks evaluate correctly with those values. It also uses  loads less code.

- Resolved an issue where actors with `ROLE_BUTTON` were not being added to the `renderList`.

- Abandoning hopes of getting the code-base compressed further using RoadRoller as it just does not work in Chrome after being road-rolled. I'm going to chalk this one up to some odd behavior of Chrome since Firefox has no problems with the road-rolled code. Next year I'll road-roll from the get go which will make it easier to find Chrome specific issues.

- Totally giving up on working within the js13k competition constraints because the competition has ended, and I want to add a few features tat just can't work within said constraints ;)

**21/9/2021**

- Cheval no longer produces extraneous particles on expiry.

- Buttons are now 20 pixels high to make room on the options menu for more buttons.

- Added a new control for applying reverse thrusting.

</div>
