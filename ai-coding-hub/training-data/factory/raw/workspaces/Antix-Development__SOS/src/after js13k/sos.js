/*

SOS

By Cliff Earl, Antix Development, 2021.

I humbly apologize for the unreadableness of my code

*/

// #region Remove for production
// let log = (t) => {console.log(t);}; // REM
// #endregion

// #region General purpose constants
let D = document,
W = window,
STORAGE = W.localStorage,
M = Math,
max = M.max,
min = M.min,
random = M.random,
floor = M.floor,
abs = M.abs,
atan2 = M.atan2,
sin = M.sin,
cos = M.cos,
PI = M.PI,
PI2 = M.PI*2,
DEGTORAD  = PI / 180,
RADTODEG  = 180 / PI,
EVENODD = 'evenodd', // Such a  pathetic minimization effort :D

FLASH_DURATION = 0.075, // Duration of flash when any given actor is flashing

// #endregion

// #region Debugging
DEBUG= 0,
debugLabel,
// #endregion

// #region Menus
NAMESPACE = 'com.antix.sos.', // Namespace for localstorage operations

OPTIONS,
optionsChanged, // True if the player changed an option

audioEnabledButton,

awaitingControlKey= 0, // True if waiting for the player to press a key to remap a control
controlIndex, // Index of the control that is being changed

CONTROL_LEFT = 0, // Values for controlIndex
CONTROL_RIGHT = 1,
CONTROL_THRUST = 2,
CONTROL_FIRE = 3,
CONTROL_REVERSE = 4,

controlLeftButton, //Button pointers
controlRightutton,
controlThrustButton,
controlFireButton,
controlReverseButton,
controlButton,

// mainMenu,

SCORES,
scoreTiteLabel, // The title of the high scores menu
newScoreLabel, // The name that the player is entering
newScore, // The score that was most recently added to the list of high scores
enteringName= 0, // True if the player is entering a name on the high score menu
newHigh,

label,

// #endregion

// #region Various Dimensions

STAGE_SIZE = 256, // Dimensions of the main display (it is a square)

FULL_GRID_SIZE = 64, // Size of grid used for generating the background
HALF_GRID_SIZE = 32,

TILE_SIZE = 16, // Size of background tile images (squares again)

WORLD_SIZE = FULL_GRID_SIZE * TILE_SIZE, // World dimensions
MID_WORLD = WORLD_SIZE / 2,

LEFTEDGE = 128,
RIGHTEDGE = WORLD_SIZE - 128,

// #endregion

// #region Sound Effect Variables
// Indexes into the fX array for playing that particular sound effect
FX_NONE           = 0,
FX_THRUST         = 1,
FX_RESCUED        = 2,
FX_WAVE_BEGIN     = 3,
FX_WAVE_END       = 4,
FX_ENEMY_BULLET   = 5,
FX_PLAYER_BULLET  = 6,
FX_EXPLOSION_1    = 7,
FX_MINE           = 8,
FX_BULLET_1       = 9,
FX_BULLET_3       = 10,
FX_EXPLOSION_2    = 11,
FX_BULLET_2       = 12,
FX_CLICK          = 13,
FX_SWARM_WARNING  = 14,
FX_GAME_OVER      = 15,
FX_MISSILE        = 16,
FX_AGGRESSOR_ALERT= 17,
FX_ERROR          = 18,
FX_HIT            = 19,

// #endregion

// #region Actor Roles
ROLE_IMAGE        = 1, // Player does not collide with actors with the following roles
ROLE_TEXTFIELD    = 2,
ROLE_BUTTON       = 3,
ROLE_PARTICLE     = 4,
ROLE_PLAYER       = 5, // Player does not collide with its self
ROLE_BULLET       = 6, // Or its own projectiles
ROLE_CITIZEN      = 7, // Player collides with all actors with the following roles
ROLE_ENEMY        = 8,
// #endregion

// #region Pooled Actor data
INITIAL_POOL_CAPACITY = 1024, // The pool of actors will start with this many (but grow if required)
IN = [], // List of "available" actors.
OUT = [], // List of "in-use" actors.
// #endregion

// #region Scene Rendering Variables

TARGET, //The actor that the camera is currently tracking

ATLAS, // The generated texture atlas

CANVAS, // The main display canvas
CTX, // Drawing context for main game display

BACKGROUND_CANVAS, // Canvas used for drawing the background
BACKGROUND_CTX, // Drawing context for the above

renderList = [], // List of actors that will be drawn in the current frame
// #endregion

// #region Collision Variables
collisionList = [], // List of actors that can be colliding next frame
collisionEnabled = 0,
// #endregion

// #region Game State variables
DT, // Milliseconds elapsed since last EnterFrame event
thisFrame, // Date of current EnterFrame event
lastFrame, // Date of last EnterFrame event
paused = 0, // True if the application is in the paused state (where enemy and bullet AI is suspended)

keysEnabled = 0, // True to enable keyboard input
cursorVisible = 1, // True if the pointer is visible

transitionAlpha = 1,
transitionDirection = 0,
transitioning = 0, // True if fading scene in or out
onTransitionComplete = 0,
aiEnabled = 0, // True if enemy and bullet actors can update their states

// #endregion

// #region User Interface Variables
HIGH_SCORE_LABEL = 'High Scores', // Strings
OPTIONS_LABEL = 'Options',
ON_LABEL = 'Enabled',
OFF_LABEL = "Disabled",

BUTTONS = [], // List of buttons that can be clicked
ui_locked = 1,
ui_selected = 0, // Widget that was most recently clicked on
ui_fontX = 32, // Coordinates of the font inside the main texture atlas
ui_fontY = 96,

helpImages = [],
logoImage = 0,
sparkleCounter = 1,

// #endregion

// #region Spawn Points
spawnPoints = [ // Start positions and orientations for the player, AND the aggressor enemy
  [32, 32, 45], // Top left, facing south east
  [WORLD_SIZE - 32, 32, 135], // Top right, south west
  [32, WORLD_SIZE -32, -45], // Bottom left, facing north east
  [WORLD_SIZE - 32, WORLD_SIZE - 32, 225], // Bottom right, facing north west
],
// #endregion

// #region Player Related variables
PLAYER_MAX_VELOCITY = 60, // Some constants applying to the player
PLAYER_TURN_SPEED = 270,
PLAYER_BULLET_SPEED = 300,
PLAYER_RELOAD_DURATION = 0.1,
PLAYER_BULLET_TTL = .75,
PLAYER_MAX_LIFE = 9,

PLAYER, // The player!!!
playerRotating = 0, // True if the player is rotating
playerThrusting = 0, // True if the player is applying a thrust impulse in the direction it is facing
playerThrustDelay = 0, // counter to stop too many particles being generated
playerReversing = 0, // True if the player is applying negative thrust impulse in the direction it is facing
playerReloadCounter = 0, // Countdown till player able to fire again
playerCanFire = 0, // True of the player can fire
playerFiring = 0, // True if the SPACE key is being held
playerScore, // Player score
playerScoreChanged = 0, // If true, the player score label will be updated this frame
scoreLabel, // HUD element showing player score
playerLife, // How much life the player has. When life reaches zero... it's game over baby!
lifeImage, // HUD element showing life remaining
// #endregion

// #region Parallax Starfield variables
STARS = [], // Stars belonging to the parallax starfield are stored here
starPalettes = [
  ['#336', '#668', '#eef'],

  ['#036', '#608', '#ee0'],
  ['#306', '#660', '#0ef'],
  ['#330', '#068', '#e0f'],
], // Star palettes
starColors, // Star colors from farthest to nearest (must contain one value for each layer)
starCounter = 0, // Stars change colors (in menus) when this goes below 0
// #endregion

// #region Attack Wave variables
WAVE, // Attack wave
waveScalar, // Multiplier for scaling enemy difficulty
infoVisible= 0, // True when showing the info label
infoCounter, // Countdown till the info is done
infoLabel, // Info label to display messages to the player
infoCallback, // When infoCounter expires, run this code

doomCounter, // When this reaches 0, an aggressor will be spawned
doomLabel, // HUD display for doomCounter
TIME_TILL_DOOM = 60,
DOOM_DELAY = 5,

CITIZENS = [], // Citizens to be rescued are stored here
citizenCount = 0, // Number of citizens in the current wave
rescuedCount = 0, // How many citizens have been rescued
rescuedLabel, // HUD element showing how many citizens have been rescued and the total number of ctizens
greenIndicator, // HUD element pointing in the direction of the closest citizen
// #endregion

// #region Texture Regions

// TextureRegion indexes
TR_BUTTON             = 0, // These regions are hard coded into the textureRegions array
TR_LOGO               = 1,
TR_THRUST             = 2,
TR_LIFE_BAR           = 3,

TR_PLAYER             = 4, // The remaining regions are pushed into the textureRegions array during asset generation
TR_CITIZEN            = 5,
TR_PLAYERBULLET       = 6,
TR_EXPLOSION_LRG_YELO = 7,
TR_EXPLOSION_SML_YELO = 8,
TR_SCOUT              = 9,
TR_AGGRESSOR          = 10,
TR_BOMBER             = 11,
TR_MINE               = 12,
TR_CARRIER            = 13,
TR_SWARMER            = 14,
TR_ROAMER             = 15,
TR_BULLET1            = 16,
TR_BULLET2            = 17,
TR_BULLET3            = 18,
TR_MISSILE            = 19,
TR_INDICATOR_GREEN    = 20,
TR_EXPLOSION_SML_BLUE = 21,
TR_SPARKLE            = 22,

TR_25                 = 23, // These are append near the end of generateAssets(). Yes, it's messy as f**k
TR_50                 = 24,
TR_75                 = 25,
TR_100                = 26,
TR_125                = 27,
TR_150                = 28,
TR_175                = 29,
TR_200                = 30,

// Texture region descriptors (coordinates and dimensions of sub images inside the main atlas).
// Each descriptor consists of [x, y, width, height]
textureRegions = [
  [304, 32, 5, 20],     //  0 3-patch button left
  [512, 0, 214, 91],    //  1 Logo
  [392, 48, 8, 8],      //  2 Thrust
  [0, 248, 72, 8],      //  2 Life indicator

  // The remaining texture regions are generated from the remapping descriptors during generateAssets()
],
// #endregion

// #region Atlas Generation Data

// Polygon coordinates for the rendered logo. I know.. it's really too awesome!
outerS = [0,70, 15,55, 39,55, 15,31, 15,27, 25,17, 83,17, 68,32, 44,32, 68,56, 68,60, 58,70],
innerS = [7,67, 17,58, 39,58, 41,56, 41,53, 18,30, 18,28, 26,20, 76,20, 67,29, 44,29, 42,31, 42,34, 65,57, 65,59, 57,67],
outerO1 = [62,46, 62,43, 105,0, 109,0, 152,43, 152,44, 108,88, 104,88],
innerO1 = [65,44, 106,3, 108,3, 148,43, 107,84, 105,84],
outerO2 = [86,45, 86,43, 106,23, 108,23, 127,42, 127,44, 107,64, 105,64], 
innerO2 = [89,44, 107,26, 124,43, 106,61],

// Actor palettes are comprised of multiple colors from this master palette
colors = [
  [40, 40, 40],      // 0  Black
  [85,85,85],       // 1  Dark grey
  [187, 187, 187],  // 2  Light grey
  [255, 255, 255],  // 3  White
  [144, 32, 32],    // 4 Dark red - UI button
  [224, 48, 48],    // 5 Red
  [240, 140, 140],  // 6 Pink
  [237, 143, 52],   // 7  Orange - Explosion
  [255, 237, 137],  // 8  Yellow
  [23, 53, 91],     // 9  Dark blue
  [0, 111, 235],    // 10 Blue
  [59, 187, 250],   // 11 Sky blue
  [102, 85, 80],   // 12 Dark brown
  [140, 117, 111], // 13 Brown
  [166, 139, 131], // 14 Light brown
  [139, 0, 115],   // 15 Purple
  [243, 119, 250], // 16 Light purple
  [0, 147, 0],     // 17 Green
  [127, 207, 15],  // 18 Light green
  [135, 111, 0],    // 19 Dark sand
  [250, 227, 159],  // 20 Light sand (flesh)
  [35, 23, 139],    // 21, Darkish blue (Roamer)
  [43, 99, 72],     // 22, Swarmer
  [71, 164, 120],   // 23
  [71, 198, 178],   // 24
  [199, 75, 11],    // 25 Aggressor
  [23, 59, 91],     // 26
  [250, 151, 51],   // 27
  [79, 79, 79],     // 28 Scout

  [], // 29
  [], // 30
  [] // 31

  // More colors will be generated here for the font colors
],

// Palettes containing index into the colors array
palettes = [
  [1, 2, 3, 4, 5, 6],     //  0 - Normal
  [0, 0, 0, 0, 0, 0],     //  1 - Shadow
  [3, 3, 3, 3, 3, 3],     //  2 - Flash
  [0, 0, 0, 4, 5, 6],     //  3 - UI buttons
  [0, 0, 3],              //  4 - Font
  [7, 8, 3],              //  5 - Explosion
  [1, 2, 3, 0, 10, 11],   //  6 - Player
  [12, 13, 14],           //  7 - Tiles
  [17, 18, 3],            //  8 - bullet1 (photon)
  [21, 19, 20, 4, 5, 6],  //  9 - Roamer
  [0, 19, 20, 0, 10, 11], // 10 - Citizen
  [1, 2, 3, 4],           // 11 - Escape pod
  [17, 18, 18, 18],       // 12 - Indicator
  [9, 10, 11, 1,1,1],     // 13 - Player bullet
  [21, 15, 16, 4, 5, 6],  // 14 - Bomber / Mine
  [22, 23, 24, 4, 5, 6],  // 15 - Swarmer / Carrier
  [25, 26, 27, 4, 5, 6],  // 16 - Aggressor 
  [28, 17, 18, 4, 5, 6],  // 17 - Scout
  [4, 5, 6],              // 18 - bullet2 (muon)
  [0, 0, 1],              // 19 - life_grey
  
  [30, 31, 29]             // 20 - Rainbow font, and colored particles for explosions
],

// Colors for font generation
rainbow = [
	[255,64,64],
	[255,179,64],
	[217,255,64],
	[102,255,64],
	[64,255,140],
	[64,255,255],
	[64,140,255],
	[102,64,255],
	[217,64,255],
	[255,64,178]
],

// Array of descriptors containing information required to draw and recolor images in the atlas.
// The format of a descriptor is... [sx, sy, w, h, dx, dy, palette, pushRegion]
remappingDescriptors = [
  [32,32, 480,12, 32,96,    4, 0],    // 0 Font (white)

  [0,32, 32,8, 0,96,        10, 0],   // 1 Citizen
  [304,0, 16,24, 304,32,    3, 0],    // 2 Buttons
  [16,0, 288,16, 16,32,     7, 0],    // 3 Tiles
  [0,0, 512,32, 0,64,       2, 0],    // 4 Flash
  [278,16, 8,8, 278,48,     0, 0],    // 5 Thrust (cannot be pushed)

  [256,24, 8,8, 256,48,     13, 0],   //  Life (blue)
  [256,24, 8,8, 256,56,     19, 0],   //  Life (grey)

  [0,0, 16,16, 0,32,        6, 1],    //  Player (robo_b)
  [0,16, 96, 16, 0,48,      11, 1],   //  Citizen (major tom)
  [272,24, 8, 8, 272,56,    13, 1],   //  Player bullet (cheval)
  [320,16, 64,16, 320,48,   5, 1],    //  Explosion (large yellow)
  [384,16, 32,8, 384,48,    5, 1],    //  Explosion (Small yellow)
  [352,0, 16,16, 352,32,    17, 1],   //  Scout (delta)
  [448,0, 32,32, 448,32,    16, 1],   //  Aggressor (omega)
  [416,0, 32,32, 416,32,    14, 1],   //  Bomber (beta)
  [368,0, 16,16, 368,32,    14, 1],   //  Mine (alpha)
  [480,0, 32,32, 480,32,    15, 1],   //  Carrier (epsilon)
  [336,0, 16,16, 336,32,    15, 1],   //  Swarmer (zeta)
  [320,0, 16,16, 320,32,    9, 1],    //  Roamer (gamma)
  [296,24, 8,8, 296,56,     8, 1],    //  Enemy bullet1 (photon)
  [288,24, 8,8, 288,56,     18, 1],   //  Enemy bullet2 (muon)
  [280,24, 8,8, 280,56,     5, 1],    //  Enemy bullet3 (comet)
  [240,24, 8,8, 240,56,     0, 1],    //  Missile (buster)
  [384,16, 8,8, 384,56,     12, 1],   //  Indicator (green)
  [384,16, 32,8, 384,64,    13, 1],   //  Explosion (Small blue)
  [296,24, 8,8, 296,48,     0, 1],    //  Sparkle

],
// #endregion

// #region Explosion Effects
explosionEffects = [
  [3, 8, TR_EXPLOSION_LRG_YELO, FX_EXPLOSION_1], // [count, spread, textureRegion index, soundEffect index]
  [3, 4, TR_EXPLOSION_SML_YELO, FX_EXPLOSION_2],
  [3, 4, TR_EXPLOSION_SML_YELO, FX_NONE],
  [3, 4, TR_EXPLOSION_SML_BLUE, FX_NONE],

  [15, 24, TR_EXPLOSION_SML_BLUE, FX_GAME_OVER],
],
// #endregion

// #region Enemy Types
ET_SCOUT          = 0,
ET_BOMBER         = 1,
ET_CARRIER        = 2,
ET_ROAMER         = 3,
ET_AGGRESSOR      = 4,
ET_MINE           = 5,
ET_SWARMER        = 6,
ET_BULLET1        = 7,
ET_BULLET2        = 8,
ET_BULLET3        = 9,
ET_MISSILE        = 10,
// #endregion

// #region Enemy Attributes

// Enemy attribute indexes
EA_TEXTURE_REGION   = 0,
EA_COLLISION_RADIUS = 1,
EA_MAX_SPEED        = 2,
EA_TURN_SPEED       = 3,
EA_TARGETING_RANGE  = 4,
EA_RELOAD_DURATION  = 5,
EA_EXPLOSION_EFFECT = 6,
EA_POINT_VALUE      = 7,
EA_POINT_IMAGE      = 8,

// Enemy attributes table containing one set of attributes for each enemy type
enemyAttributes = [
  // ET_SCOUT - Orbits center of game world at a fixed distance moving in a clockwise or anti clockwise direction
  [
    TR_SCOUT,     // Texture region
    7,            // Collision radius
    0,            // Max speed - N/A - rotates using a fixed variable
    0,            // Turn speed - N/A - direction is fixed (clockwise or counter-clockwise)
    100,          // Targeting range
    .75,          // Reload duration
    1,            // Explosion effect
    75,           // Point value
    TR_75         // Point image
  ],

  // ET_BOMBER - Moves between two waypoints laying mines at random intervals
  [
    TR_BOMBER,    // Texture region
    14,            // Collision radius
    30,           // Max speed
    PI / 48,      // Turn speed
    0,            // Targeting range
    0,            // Reload duration
    1,            // Explosion effect
    125,          // Point value
    TR_125        // Point image
  ],

  // ET_CARRIER - Moves towards the player very slowly, firing salvos of missiles when they are directly facing the player. On death, the carrier spawns a number of swarmers
  [
    TR_CARRIER,   // Texture region
    14,            // Collision radius
    5,            // Max speed.. so slowwwwww
    PI / 400,     // Turn speed
    125,          // Targeting range
    .15,           // Reload duration
    1,            // Explosion effect
    150,          // Point value
    TR_150        // Point image
  ], 

  // ET_ROAMER - Randomly moves through the world, firing in random directions when the player is in range
  [
    TR_ROAMER,    // Texture region
    7,            // Collision radius
    90,           // Max speed
    0.25,         // Turn speed
    180,          // Targeting range
    1,            // Reload duration
    1,            // Explosion effect
    100,          // Point value
    TR_100         // Point image
  ],

  // ET_AGRESSOR - Moves about the player and fires missiles
  [
    TR_AGGRESSOR, // Texture region
    14,           // Collision radius
    150,          // Max speed
    PI / 115,     // Turn speed
    165,          // Targeting range
    .5,           // Reload duration
    1,            // Explosion effect
    175,          // Point value
    TR_175        // Point image
  ],

  // ET_MINE - Spawned moging in a random direction and quickly slows to become stationary. Explodes after a time
  [
    TR_MINE,      // Texture region
    7,            // Collision radius
    0,            // Max speed
    0,            // Turn speed
    0,            // Targeting range
    0,            // Reload duration
    1,            // Explosion effect
    25,           // Point value
    TR_25         // Point image
  ],

  // ET_SWARMER - Homes on the player and fires rapidly
  [
    TR_SWARMER,   // Texture region
    7,            // Collision radius
    90,           // Max speed
    PI / 48,      // Turn speed
    0,            // Targeting range
    0,            // Reload duration
    1,            // Explosion effect
    50,           // Point value
    TR_50         // Point image
  ],

  // Scouts fire these bullets
  [
    TR_BULLET1,   // Texture region
    1,            // Collision radius
    90,           // Max speed
    0,            // Turn speed
    0,            // Targeting range
    0,            // Reload duration
    3,            // Explosion effect
    0,            // Point value
    0             // Point image
  ],

  // Roamers fire these bullets
  [
    TR_BULLET2,   // Texture region
    1,            // Collision radius
    60,           // Max speed
    0,            // Turn speed
    0,            // Targeting range
    0,            // Reload duration
    3,            // Explosion effect
    0,            // Point value
    0             // Point image
  ],

  // Carriers fire these bullets
  [
    TR_BULLET3,   // Texture region
    1,            // Collision radius
    75,          // Max speed
    0,            // Turn speed
    0,            // Targeting range
    0,            // Reload duration
    3,            // Explosion effect
    0,            // Point value
    0             // Point image
  ],
  
  // Aggressors fire missiles
  [
    TR_MISSILE,   // Texture region
    1,            // Collision radius
    250,          // Max speed
    0,            // Turn speed
    0,            // Targeting range
    0,            // Reload duration
    3,            // Explosion effect
    0,            // Point value
    0             // Point image
  ],
],
// #endregion

// #region Wave Data

// Wave data indexes. Mines, swarners, and aggressors are omitted because they are spawned during gameplay
WD_CITIZEN_COUNT    = 0,
WD_SCOUT_COUNT      = 1,
WD_BOMBER_COUNT     = 2,
WD_CARRIER_COUNT    = 3,
WD_ROAMER_COUNT     = 4,

waveData = [
  [ // 0
    3,  // Citizens
    8,  // Scouts
    6,  // Bombers
    2,  // Carriers
    10   // Roamers
  ],

  [ // 1
    4,  // Citizens
    12,  // Scouts
    8,  // Bombers
    2,  // Carriers
    12   // Roamers
  ],

  [ // 2
    5,  // Citizens
    16,  // Scouts
    8,  // Bombers
    4,  // Carriers
    14   // Roamers
  ],

  [ // 3
    6,  // Citizens
    20, // Scouts
    10,  // Bombers
    4,  // Carriers
    16   // Roamers
  ],

  [ // 4
    7,  // Citizens
    24, // Scouts
    10,  // Bombers
    4,  // Carriers
    18   // Roamers
  ],

  [ // 5
    8,  // Citizens
    26, // Scouts
    10,  // Bombers
    6,  // Carriers
    20  // Roamers
  ],
  
  [ // 6
    9,  // Citizens
    28, // Scouts
    12,  // Bombers
    6,  // Carriers
    22  // Roamers
  ],

  [ // 7
    10, // Citizens
    30, // Scouts
    12,  // Bombers
    6,  // Carriers
    24  // Roamers
  ],

  [ // 8
    10, // Citizens
    30, // Scouts
    14,  // Bombers
    8,  // Carriers
    26  // Roamers
  ],

  [ // 9
    10, // Citizens
    30, // Scouts
    16,  // Bombers
    10,  // Carriers
    28  // Roamers
  ]
],
// #endregion

// #region Utility Functions
// Get a random integer from 0 to the given maximum
rInt = (m) => {
  return floor(random() * m);
},
// Get a random direction in degrees
randomAngleDEG = () => {
  return random() * 360;
},
// Get a random angle in radians
randomAngleRAD = () => {
  return random() * PI;
},
// Rescale the display
rescale = () => {
  let scale = min(W.innerWidth / STAGE_SIZE, W.innerHeight / STAGE_SIZE); // Calculate scalar
  D.body.style.transform = 'scale(' + scale + ')'; // Scale the canvas
  D.body.style.paddingLeft = floor(((W.innerWidth - CANVAS.getBoundingClientRect().width) / 2) / scale) + 'px'; // Center the canvas on the x-axis
},
// Create a new canvas with the given dimensions
newCanvas = (w, h) => {
  let canvas = D.createElement('canvas'), // Create a new canvas
  ctx = canvas.getContext('2d'); // Get drawing context
  canvas.ctx = ctx;
  canvas.width = w; // Set canvas dimensions
  canvas.height = h;
  canvas.ctx.imageSmoothingEnabled= 0; // For some messed up reason it only works with this, not just ctx.
  return canvas;
},
// Constrain the given  number into the given range
clamp = (v, min, max) => {
  return v < min ? min : v > max ? max : v;
},
// Show or hide the cursor as required
showCursor = (state) => {
  if (state) {
    if (!cursorVisible) { // Only show the cursor if it is not visible
      D.body.style.cursor = 'auto';
    }
  } else {
    if (cursorVisible) { // Only hide the cursor if it is visible
      D.body.style.cursor = 'none';
    }
  }
  cursorVisible = state; // Save the state
},
// Return a random spawn point
randomSpawnPoint = () => {
  return spawnPoints[rInt(spawnPoints.length - 1)]; // Get a random starting position
},
// Draw to the main context
drawMain = (sx, sy, w, h, dx, dy) => {
  CTX.drawImage(ATLAS, sx, sy, w, h, dx, dy, w, h);
},
// Clear the background canvas
clearBackGround = () => {
  BACKGROUND_CTX.clearRect(0, 0, WORLD_SIZE, WORLD_SIZE);
},
// execute this code when the application is about to enter the waves or game over states
disableEverything = () => {
  keysEnabled= 0; // Disable keyboard input processing
  aiEnabled= 0; // Disable enemy and bullet AI
  collisionEnabled= 0; // Disable collision checking

  playerRotating= 0; // Lock player rotation
  playerThrusting= 0; // Stop more thrust particles being created
  PLAYER.vX = 0;
  PLAYER.vY = 0;
  playerFiring= 0;
  PLAYER.v= 0; // Hide the player imagery
},
// #endregion

// #region Local Storage management
// Save the given data with the given name to local storage
saveLocalFile = (n, data) => {
  STORAGE.setItem(NAMESPACE + n, JSON.stringify(data));
},
// Load the item with the given name from local storage
loadLocalFile = (n) => {
  return STORAGE.getItem(NAMESPACE + n);
},
// Save high scores to local storage
saveScores = () => {
  saveLocalFile('s', SCORES);
},
// Reset high scores
resetHighScores = () => {
  SCORES = [];
  for (let i = 5; i > 0; i--) { // Create this many scores
    addNewScore('ANTIX', i * 10000);
  }
  saveScores(); // Save scores
},
// Save options to local storage
saveOptions = () => {
  saveLocalFile('o', OPTIONS);
},
// Reset the options to default and save them to local storage
resetOptions = () => {
  OPTIONS = {
    a: true, // Audio enabled
    c: [ // Controls
      { // Left
        k: 188, // Keycode
        c: 'Comma' // Ascii representation
      },
      { // Right
        k: 190,
        c: 'Period'
      },
      { // Forward thrust
        k: 17,
        c: 'ControlLeft'
      },
      { // Fire
        k: 32,
        c: 'Space'
      },
      { // Reverse thrust
        k: 16,
        c: 'ShiftLeft'
      },
    ]
  };

  saveOptions(); // Save options to local storage
},
// #endregion

// #region High Score Management
// Add the given score and given name to the highh score list, sort it, truncate it, then save it
addNewScore = (name, score) => {
  let newScore = { // Create a new score
    n: name,
    s: score,
  };

  SCORES.push(newScore); // Append the new score to the list

  SCORES.sort((a, b) => (a.s < b.s)  ? 1 : -1); // Sort
  
  SCORES.length = 5; // Nasty truncation
  return newScore; // Required for highscore checking
},
// #endregion

// #region Actor - A general purpose sprite that is used for pretty much all game objects
// Create a new blank actor containing all common variables
newActor = () => {
  return {
    r: 0, // Role (ROLE_PlAYER, ROLE_PARTICLE, ROLE_IMAGE, etc)
  
    x: 0, // Global coordinates
    y: 0,
  
    lX: 0, // Local coordinates
    lY: 0,
  
    vX: 0, // Velocity
    vY: 0,
  
    rot: 0, // Rotation
    rR: 0, // Rotation rate
  
    s: 1, // Scale
    a: 1, // Alpha
    
    tR: 0, // Texture region
    rX: 0, // Texture radius x
    rY: 0, // Texture radius y

    oX: 0, // Image offsets (added whenever the actor os drawn for animation purposes)
    oY: 0,

    cS: 0, // Draw a shadow for this actor if true

    z: 0, // Z-index

    // cR: 0, // Collision Radius

    v: 0, // True if visible

    f: 0, // True if this actor flashes
  };
},
// Set the given actors world coordinates
setPosition = (a, x, y) => {
  a.x = x;
  a.y = y;
},
// Set the given actors texture region and calculate its image radius (iR)
setTextureRegion = (a, r) => {
  a.tR = r; // Save the texture region
  a.rX = r[2] / 2; // Save the radius of the region
  a.rY = r[3] / 2; // Save the radius of the region
},
// Get the texture region at the given index
getTextureRegion = (r) => {
  return textureRegions[r];
},
// Make the given actor flash for a time
flash = (actor) => {
  if (!actor.f) {
    actor.f = 1;
    actor.oY = 32;
    actor.fC = FLASH_DURATION;
  }
},
// Update the given actors flash state
doFlash = (actor) => {
  if (actor.f) { // Is the actor currently flashing?
    if ((actor.fC -= DT) <= 0) { // If countdown reaches 0...
      actor.oY = 0; // Y offset in atlas to flashing image
      actor.f= 0; // set actor not flashing
    }
  }
},
// Return true if the given actor is on-screen (visible to the player). NOTE: Iterating is actually faster than calling indexOf()??
onScreen = (actor) => {
  for (let i = 0; i < renderList.length; i++) { // Check all actors
    if (renderList[i] == actor) { // Is this the actor we were looking for?
      return 1; // The actor is contained inside the render list
    }
  }
  return 0; // The actor was not found
},
// Set the given actors position to random coordinates in the world
randomizePosition = (actor, ) => {
  setPosition(actor, 256 + (rInt(WORLD_SIZE - 512)), 256 + (rInt(WORLD_SIZE - 512))); // Position the citizen at random coordinates
},
// #endregion

// #region Pool - A simple pool of reusable actors that  starts with a specified capacity and then grows as required.
// Create and add a new actor to the pool of "available" actors
growPool = () => {
  let actor = newActor();
  IN.push(actor);
  return actor;
},
// Return all actors to the pool.
resetPool = () => {

  // 
  // It is easier to just recreate it, rather than reset all of the actors variables. I also ran out of time at the end because of a bug that is related to actors not being reset correctly.
  // 

  IN = [];
  OUT = [];
  for (let i = 0; i < INITIAL_POOL_CAPACITY; i++) {
    growPool(); // add a new actor to the pool
  }

    // if (OUT.length > 0) {
  //   for (let i = 0; i < OUT.length; i++) {
  //     IN.push(OUT[i]); // Return to pool of "available" actors
  //   }
  //   OUT = []; // Clear the "in-use" list of actors
  // }

},
// Get a new actor for use (creating a new one if there are no free ones available).
getActor = (role) => {
  let actor = IN.pop(); // Get the next available actor

  if (actor == undefined) actor = growPool(); // Create a new actor if the list of "available" actors is empty

  OUT.push(actor); // Add to the list of "in use" actors

  actor.r = role;

  actor.v = 1; // Generally we will want the actor to be visible

  actor.cS= 0; // By default cast no shadow

  actor.lX = 0; // Local coordinates
  actor.lY = 0;

  actor.oX = 0; // No offsets
  actor.oY = 0;

  actor.vX = 0; // Zero velocities
  actor.vY = 0;

  actor.rot = 0; // Reset rotation
  actor.iX = 0;

  actor.a = 1; // Alpha
  actor.s = 1; // Scale
  actor.rR = 0; // Rotation rate

  actor.A= 0; // He was D.O.A sir :(

  actor.T = 0; // Actor has no target
  
  
  actor.z = 1;

  return actor;
},
// Return the given actor to the this.
freeActor = (actor) => {
  OUT.splice(OUT.indexOf(actor), 1); // Remove actor from list of "in-use" actors
  IN.push(actor); // Return to pool of "available" actors
},

// #endregion

// #region Sound Effects
/*
Sound Effects

A basic sound effect player that plays sounds created using ZzFX.

By Cliff Earl, Antix Development, 2021.

Usage:
------
To add a new sound effect, call g.fx_new(parameters) like so...
g.fx_new([1.01,.05,259,0,.1,.2,2,1.58,0,0,0,0,0,0,1.1,0,0,.7,.07,0]);

To play a sound effect call g.fx_play(index)

NOTE: In this version of the code, an index of 0 will not play anything.

If you were pondering  how parameters for new sound  effects are created, use
ZzFX  (https://github.com/KilledByAPixel/ZzFX).  NOTE:  Untick  the  "spread"
checkbox!

There is also a global volume variable that you can poke... gV

Acknowledgements:
-----------------
This code is a heavily modified version of zzfx.js, part of ZzFX.

ZzFX - Zuper Zmall Zound Zynth v1.1.6
By Frank Force 2019
https://github.com/KilledByAPixel/ZzFX

ZzFX MIT License

Copyright (c) 2019 - Frank Force

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
gV = .3, // Global volume
sR = 44100, // Sample rate
aC = 0, // Audio context
fx = [], // List of all fx (storred and accessed by name)
// Create and add samples to the list of all playable effects, using the given zzfx parameters
fx_add = (parameters) => {
  fx.push(fx_bS(...parameters));
},
// Play the fx with the given name
fx_play = (index) => {
  if (OPTIONS.a && index > FX_NONE) return fx_pS(fx[index - 1]); // Play the sound if it isn't FX_NONE, and sound effects are enabled in options
},
// Play an array of samples
fx_pS = (samples) => {
  if (!aC) aC = new (W.AudioContext || W.webkitAudioContext); // Create audio context if it does not exist.
  // play an array of audio samples
  const buffer = aC.createBuffer(1, samples.length, sR),
  source = aC.createBufferSource();
  buffer.getChannelData(0).set(samples);
  source.buffer = buffer;
  source.connect(aC.destination);
  source.start(0);
  return source;
},
// Build an array of samples
fx_bS = (volume, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo) => {
  // init parameters
  let sampleRate = sR,
  sign = v => v>0?1:-1,
  startSlide = slide *= 500 * PI2 / sampleRate / sampleRate,
  startFrequency = frequency *= PI2 / sampleRate, b=[], t=0, tm=0, i=0, j=1, r=0, c=0, s=0, f, length;

  // scale by sample rate
  attack = attack * sampleRate + 9; // minimum attack to prevent pop
  decay *= sampleRate;
  sustain *= sampleRate;
  release *= sampleRate;
  delay *= sampleRate;
  deltaSlide *= 500 * PI2 / sampleRate**3;
  modulation *= PI2 / sampleRate;
  pitchJump *= PI2 / sampleRate;
  pitchJumpTime *= sampleRate;
  repeatTime = repeatTime * sampleRate | 0;

  // generate waveform
  for(length = attack + decay + sustain + release + delay | 0; i < length; b[i++] = s) {
      if (!(++c%(bitCrush*100|0))) { // bit crush
        
        s = shape? shape>1? shape>2? shape>3?         // Wave shape
            sin((t%PI2)**3) :                       // 4 noise
            max(min(M.tan(t),1),-1):              // 3 tan
            1-(2*t/PI2%2+2)%2:                        // 2 saw
            1-4*abs(M.round(t/PI2)-t/PI2):          // 1 triangle
            sin(t);                                 // 0 sin

        s = (repeatTime ?
                1 - tremolo + tremolo*sin(PI2*i/repeatTime) // Tremolo
                : 1) *
            sign(s)*(abs(s)**shapeCurve) *          // Curve 0=square, 2=pointy
            volume * gV * (                         // Envelope
            i < attack ? i/attack :                   // Attack
            i < attack + decay ?                      // Decay
            1-((i-attack)/decay)*(1-sustainVolume) :  // Decay falloff
            i < attack  + decay + sustain ?           // Sustain
            sustainVolume :                           // Sustain volume
            i < length - delay ?                      // Release
            (length - i - delay)/release *            // Release falloff
            sustainVolume :                           // Release volume
            0);                                       // Post release

        s = delay ? s/2 + (delay > i ? 0 :            // delay
          (i<length-delay? 1 : (length-i)/delay) *    // release delay 
          b[i-delay|0]/2) : s;                        // sample delay
    }

    f = (frequency += slide += deltaSlide) * cos(modulation*tm++); // Frequency
    t += f - f*noise*(1 - (sin(i)+1)*1e9%2); // Noise

    if (j && ++j > pitchJumpTime) { // Pitch jump
      frequency += pitchJump; // Apply pitch jump
      startFrequency += pitchJump; // Also apply to start
      j = 0; // Stop pitch jump time
    }

    if (repeatTime && !(++r % repeatTime)) { // Repeat
    frequency = startFrequency; // Reset frequency
    slide = startSlide; // Reset slide
    j = j || 1; // Reset pitch jump time
    }
  }
  return b;
},
// #endregion

transitions = [],
transitionCallbacks = [],

// #region Scene Transition
// Begin a scene transition. Basically this sets a global alpha value that is applied to every actor that is drawn, effectively alpha fading the entire scene in and out
transition = (direction, callback) => {
  ui_locked = 1; // Disable button clicking
  keysEnabled = 0; // disable keyboard input
  transitionAlpha = direction; // Set alpha
  transitionDirection = direction; // Set fading in or out
  onTransitionComplete = callback; // Save callback code
  transitioning = 1; // Set application to be transitioning
},
// A transition has completed, set application to not be transitioning, and call onTransitionComplete code
transitionComplete = () => {

  transitioning = 0;

  onTransitionComplete(); // Call code
},
// #endregion

// #region User Interface
// Get the width of the given string in pixels using the metrics contained within the font descriptor
ui_strWidth = (str) => {
  let w = 0, // Width of the string in pixels
  char;
  for (let i = 0; i < str.length; i++) {
    char = fontDescriptor.c[str.charCodeAt(i) - fontDescriptor.f]; // Next character descriptor (x, w)
    w += (char[1] + 1); // Add its width + 1
  }
  return w;
},
// Render the given string into the given drawing context at the given coordinates
ui_renderString = (x, y, str, ctx, color = 0) => {
  for (let i = 0; i < str.length; i++) { // Process all characters
    let c = str.charCodeAt(i) - fontDescriptor.f, // Get character as a decimal number
    char = fontDescriptor.c[c]; // Get characters subimage coordinates within font atlas
    if (c > 0) { // 0 is space, so don't draw that
      ctx.drawImage(ATLAS, char[0] + ui_fontX, ui_fontY + color * 12, char[1], fontDescriptor.h, x, y, char[1], fontDescriptor.h); // Draw the character at the coordinates
    }
    x += (char[1] + 1); // Advance cursor to right
  }
},
// Determine if the mouse is inside any buttons area
ui_hit = (e) => {
  let x = e.offsetX, // Get click coordinates
  y = e.offsetY;
  for (let j = 0; j < BUTTONS.length; j++) { // Process all buttons
    let button = BUTTONS[j]; // Next button
    let l = button.x, // Get button coordinates
    t = button.y;
    if ((x > l) && (x < l + button.w) && (y > t) && (y < t + button.h)) return button; // Return the button that was pressed or released
  }
  return 0; // No button was clicked
},
// Handle mouse pressed and released events according to the given mode
ui_mouseHandler = (e, buttonUp) => {
  if ((!ui_locked) && (e.button == 0)) { // Only process the primary button, and only if there are no transitions in progress

    let widget = ui_hit(e); // Check if the mouse was over any widget when it was pressed or released
    if (widget) {
      if (buttonUp) { // 0 = pressed, 1 = released
        // 
        // Mouse released on a widget
        // 

        if (widget == ui_selected) widget.f(); // Execute widget function
        ui_selected = 0; // Unselect widget
      
      } else {

        // 
        // Mouse pressed on a widget
        // 

        ui_selected = widget; // Set selected widget
      }
    } else { // Mouse released while the mouse was not over any widget
      ui_selected = 0; // Unselect widget (if one was even selected)
    }
  }
},
// Pass the event and mode to the handler for mouse down events
ui_mouseDown = (e) => {
  ui_mouseHandler(e, 0);
},
// Pass the event and mode to the handler for mouse up events
ui_mouseUp = (e) => {
  ui_mouseHandler(e, 1);
},
// Create a new image actor using the given parameters
newImage = (x, y, region) => {
  let image = getActor(ROLE_IMAGE),
  r = getTextureRegion(region); // Create the new image actor
  setPosition(image, x, y); // Set coordinates
  setTextureRegion(image, r); // Set texture region
  return image;
},
// Set the label for the given button and redraw it
setButtonLabel = (button, label) => {
  button.label = label;
  let r = getTextureRegion(TR_BUTTON); // Get 3-patch button textureRegion
  button.ctx.drawImage(ATLAS, r[0] + BUTTON_END_WIDTH,r[1], 1,BUTTON_HEIGHT, BUTTON_END_WIDTH,0, button.w - (BUTTON_END_WIDTH * 2), BUTTON_HEIGHT); // Fill middle bit
  ui_renderString(floor((button.w - ui_strWidth(button.label)) / 2), floor((BUTTON_HEIGHT - fontDescriptor.h) / 2) + 1, button.label, button.ctx); // Render the string into the canvas
},
BUTTON_HEIGHT = 20,
BUTTON_END_WIDTH = 5,

// Create a new button at the given coordinates with the given label, that executes the given callback code when it is clicked
newButton = (x, y, w, s, callback) => {
  let button = getActor(ROLE_BUTTON), // Create the button actor

  r = getTextureRegion(TR_BUTTON), // Get 3-patch button textureRegion
  canvas = newCanvas(w, BUTTON_HEIGHT), // Create a new canvas
  ctx = canvas.ctx; // Get drawing context

  setPosition(button, x, y); // Set coordinates

  button.ctx = ctx;

  button.i = canvas; // Save canvas for drawing
  button.w = w; // Save dimensions
  button.h = BUTTON_HEIGHT;

  button.label = s;

  button.f = callback; // Save "clicked" code

  setTextureRegion(button, [0, 0, w, 24]); // Create and save a textureRegion

  ctx.drawImage(ATLAS, r[0],r[1], BUTTON_END_WIDTH,BUTTON_HEIGHT, 0,0, BUTTON_END_WIDTH,BUTTON_HEIGHT); // Draw left button bit...
  ctx.drawImage(ATLAS, r[0] + BUTTON_END_WIDTH,r[1], 1,BUTTON_HEIGHT, BUTTON_END_WIDTH,0, w-(BUTTON_END_WIDTH * 2),BUTTON_HEIGHT); // Middle button bit...

  setButtonLabel(button, s); // Draw middle bit and draw label

  ctx.drawImage(ATLAS, r[0] + 7,r[1], BUTTON_END_WIDTH,BUTTON_HEIGHT, w-BUTTON_END_WIDTH, 0, BUTTON_END_WIDTH,BUTTON_HEIGHT); // And right button bit
  // ui_renderString(floor((w - ui_strWidth(s)) / 2), floor((24 - fontDescriptor.h) / 2) + 1, s, ctx); // Render the string into the canvas

  BUTTONS.push(button); // Add to list of buttons that can be clicked

  return button;
},
// Create a new text field actor using the given parameters
newTextField = (label, x, y, c = 0) => {
  let textField = getActor(ROLE_TEXTFIELD); // Create the new textfield actor

  setPosition(textField, x, y); // Set coordinates

  textField.label = label; // set the label
  textField.z = 9; // Make sure it is drawn on top of most other imagery
  textField.c = c; // Save color
  return textField; // Return it because some other functions need that
},
// Return the x position for the given string that will center it on the x-axis
centerText = (s) => {
  return 128 - ui_strWidth(s) / 2; // Retirn the centered x coordinate
},
// Create a new text field that is centered on the x axis
newCenteredTextField = (s, y, c = 0) => {
  return newTextField(s, centerText(s), y, c);
},
// Show an info text to the player which fades out after a second
showInfo = (s, callback, duration = 2) => {
  infoLabel = newCenteredTextField(s, 120); // Create the label
  infoCallback = callback; // Save code to be run when fthe label is faded out
  infoCounter = duration; // Reset fade counter
  infoVisible = 1; // Enable info text fade
},
// Font (Windows10 builtin "small fonts"). Each character descriptor in fontDescriptor.c contains the x position and width, the other dimensions are hard coded
fontDescriptor={f:32,h:11,c:[[0,4],[468,3],[0,0],[134,7],[141,7],[46,8],[148,7],[0,0],[442,4],[434,4],[430,4],[389,5],[453,3],[426,4],[462,3],[422,4],[353,6],[418,4],[383,6],[239,6],[245,6],[341,6],[251,6],[257,6],[263,6],[269,6],[450,3],[474,3],[0,0],[394,5],[0,0],[0,0],[10,10],[126,8],[38,8],[62,8],[54,8],[204,7],[211,7],[78,8],[86,8],[471,3],[275,6],[218,7],[281,6],[0,10],[94,8],[118,8],[110,8],[102,8],[70,8],[197,7],[190,7],[183,7],[176,7],[20,9],[169,7],[162,7],[155,7],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[293,6],[299,6],[305,6],[311,6],[317,6],[414,4],[323,6],[329,6],[456,3],[459,3],[335,6],[465,3],[29,9],[347,6],[225,7],[359,6],[287,6],[438,4],[365,6],[446,4],[371,6],[377,6],[232,7],[399,5],[404,5],[409,5]]},
// #endregion

// Convert HSL to rGB (https://www.30secondsofcode.org/js/s/hsl-to-rgb)
HSLToRGB = (h, s, l) => {
  let k = n => (n + h / 30) % 12,
  a = s * min(l, 1 - l),
  f = n => l - a * max(-1, min(k(n) - 3, min(9 - k(n), 1)));
  return [floor(255 * f(0)), floor(255 * f(8)), floor(255 * f(4))];
},

// #region Planet Generation
// Procedurally generate a circular planet-like background
generateBackground = () => {

  let grid = [],
    n, // Misc vars
    r,
    c,
    y,
    x,

    // Draw a semi filled horizontal line into the grid at the given coordinates using derived length
    line = (x0, x1, y) => {
      for (c = x0 + HALF_GRID_SIZE; c < x1 + HALF_GRID_SIZE; c++) { // This many cells will be processed
        if (random() < .51) { // 50% of cells will be alive
          grid[y + HALF_GRID_SIZE][c] = 1; // Set cell as "alive"
        }
      }
    },

    rgb = HSLToRGB(randomAngleDEG(), .48, .63);
  
    // let rgb = hsvToRgb(random(), .48, .63);
    colors[29] = [rgb[0], rgb[1], rgb[2]]; // Set color
    colors[30] = [floor(rgb[0] / 2), floor(rgb[1] / 2), floor(rgb[2] / 2)]; // Set darker version
    colors[31] = [floor(rgb[0] / 1.5), floor(rgb[1] / 1.5), floor(rgb[2] / 1.5)]; // Set darker version
  
    // remappingDescriptors[5][6] = 20;
    // remap (remappingDescriptors[5], ATLAS.ctx); // Tileset
  
    remap ([16,0, 288,16, 16,32, 20, 0], ATLAS.ctx); // Tileset

    // 
    // Populate the grid with empty rows
    // 

    for (r = 0; r < FULL_GRID_SIZE; r++) { // Number of rows
      n = []; // Create a new row
      for (c = 0; c < FULL_GRID_SIZE; c++) { // Number of columns
        n.push(0); // Push a dead cell into the row
      }
      grid.push(n); // Add the row to the grid
    }

    // // The following code can be used as a fallback if the 13Kb limit is exceeded...
    // // It fills a rect with random "alive" cells, which takes less code than the circle method
    // for (r = 5; r < FULL_GRID_SIZE - 5; r++) {
    //     for (c = 5; c < FULL_GRID_SIZE - 5; c++) {
    //       (random() < .51) ? n = 1 : n = 0; // 1 = alive, 2 = dead
    //       grid[r][c] = n; // store cell
    //     }
    //   }
      
    // 
    // Draw a semi filled circle at the center of the grid with a radius just a bit smaller than the grid s radius (modified from https://landAreaoverflow.com/questions/10878209/HALF_GRID_SIZE-circle-algorithm-for-filled-circles)
    // 

    x = FULL_GRID_SIZE / 2 - 6;
    y = 0;
    
    let rErr = 1 - x;

    while (x >= y) { // Iterate to the circle diagonal
      // Use symmetry to draw the two horizontal lines at this Y with a special case to draw only one line at the cY where y == 0
      let startX = -x,
      endX = x;         
      line(startX, endX, y);
      if (y != 0) line(startX, endX, -y);
      y++; // Next line
      // calculate or maintain new x
      if (rErr < 0) {
        rErr += 2 * y + 1;
      }  else  {
        // About to move x over one, this means we completed a column of X values, use symmetry to draw those complete columns as horizontal lines at the top and bottom of the circle beyond the diagonal of the main loop
        if (x >= y) {
          startX = -y + 1;
          endX = y - 1;
          line(startX, endX,  x);
          line(startX, endX, -x);
        }
        x--;
        rErr += 2 * (y - x + 1);
      }
    }

    // 
    // Use cellular Automaton to smooth the grid
    // 

    for (r = 1; r < FULL_GRID_SIZE - 1; r++) { // NOTE: Outer edges are not computed. This saves boundry check code
      for (c = 1; c < FULL_GRID_SIZE - 1; c++) {
        // Get the number of "alive" cells surrounding this cell (all 8).
        n = 0;
        for (y = -1; y < 2; y++) {
          for (x = -1; x < 2; x++) {
            n += grid[r + y][c + x];
          }
        }
        n -= grid[r][c]; // Subtract this cell because we added it above, and it is not required.
        // Update cells state ("alive" or "dead")
        if (grid[r][c]) { // If this cell is "alive", we need to check if it will continue to live, or die.
          if (n < 3) grid[r][c] = 0 // This cell "dies" if there are less than the death limit of "alive" cells around it
        } else { // The cell is "dead", check if it can be "born"
          if (n > 4) grid[r][c] = 1 // If its a "dead" cell, it can be "born" if it is surrounded by enough "alive" cells
        }
      }
    }

    // 
    // Use 4-bit bitmasking algorithm to beautify the map (https://web.archive.org/web/20110714085234/http://www.angryfishstudios.com/2011/04/adventures-in-bitmasking/)
    // 

    for (r = 1; r < FULL_GRID_SIZE - 1; r++) {
      for (c = 1; c < FULL_GRID_SIZE - 1; c++) {
        if (grid[r][c] > 0) { // Only check solid cells
          (grid[r-1][c] > 0) ? n = 1 : n = 0; // North
          if (grid[r][c+1] > 0) n += 2; // East
          if (grid[r+1][c] > 0) n += 4; // South
          if (grid[r][c-1] > 0) n += 8; // West
          if (n == 15) { // If the tile is not an edge...
            if (random() < .15) n += rInt(4); // 15% of tiles will have extra detail added
          }
          grid[r][c] = n; // Overwrite with remapped tile
          // console.log(`c:${c} n:${grid[r-1][c]} e:${grid[r][c + 1]} s:${grid[r+1][c]} w:${grid[r][c-1]} n:${n}`);
        }
      }
    }

    clearBackGround();

    // 
    // Draw the entire map into the background canvas
    // 

    for (r = 0; r < FULL_GRID_SIZE; r++) { // Draw this many rows of columns (of tiles)
      for (c = 0; c < FULL_GRID_SIZE; c++) { // Draw this many columns of tiles
        if (grid[r][c] > 0) BACKGROUND_CTX.drawImage(ATLAS, grid[r][c] * TILE_SIZE, 32, TILE_SIZE, TILE_SIZE, c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE); // Draw the tile if it is not an empty cell
      }
    }
},
// #endregion

// Perform AI for ET_SCOUT enemy actors.
// The scount has its own update function because it can be visible when the wave begins, so needs to perform an initial update to set its position
updateScout = (scout) => {
  scout.angle += scout.spd * DT; // Update scout position on circumference of its orbit
  let x = MID_WORLD + cos(scout.angle) * scout.distance, // Calculate coordinates
  y = MID_WORLD + sin(scout.angle) * scout.distance,
  direction = angleTo(MID_WORLD - y, MID_WORLD - x); // Calculate angle from center of world to actor coordinates
  (scout.spd > 0) ? scout.rot = direction * RADTODEG + 90 : scout.rot = direction * RADTODEG - 90; // Face scout in the direction of their movement
  setPosition(scout, x, y);

},
// Set random target coordinates for the given actor in the given distance range
targetCoordinatesNearPLayer = (actor, range = 40) => {
  let distance = range + rInt(range),
  angle = randomAngleRAD(); // Pick a random direction
  actor.T = {
    x: PLAYER.x + cos(angle) * distance,
    y: PLAYER.y + sin(angle) * distance
  };
},
// 
// Spawn a new enemy of the given type at the given coordinates
// 
newEnemy = (type, x, y, a = 0) => {
  let attributes = enemyAttributes[type], // Get the base attributes for the enemy type
  
  enemy = getActor(ROLE_ENEMY), // Get a new actor to represent the enemy

  // Set the enemy velocities (purely here to save code bytes)
  setVelocities = () => {
    enemy.vX = cos(a * DEGTORAD) * enemy.mS;
    enemy.vY = sin(a * DEGTORAD) * enemy.mS;
  },

  // Scale the given attribute up
  upScaleAttribute = (v) => {
    return (v * .6) + (v * waveScalar) * .4;
  },

  // Scale the given attribute down
  downScaleAttribute = (v) => {
    return (v * 2) - (v * waveScalar);
  };

  // 
  // Initialize common variables
  // 

  if (type == ET_AGGRESSOR) { // Is it an aggressor?
    // Yes... no scaling because aggressors are supposed to be mean!
    enemy.mS = attributes[EA_MAX_SPEED];
    enemy.R = attributes[EA_TARGETING_RANGE];
    enemy.rD = attributes[EA_RELOAD_DURATION];
      
  } else { // No, scale
    enemy.mS = upScaleAttribute(attributes[EA_MAX_SPEED]);
    enemy.R = upScaleAttribute(attributes[EA_TARGETING_RANGE]);
    enemy.rD = downScaleAttribute(attributes[EA_RELOAD_DURATION]);
  
  }

  enemy.tS = attributes[EA_TURN_SPEED];
  enemy.cR = attributes[EA_COLLISION_RADIUS];
  enemy.eE = attributes[EA_EXPLOSION_EFFECT];

  enemy.pI = attributes[EA_POINT_IMAGE];
  enemy.pV = attributes[EA_POINT_VALUE];

  enemy.cF= 0; // Can fire
  enemy.rC = .1; // Reload counter

  enemy.A = 1; // It livesssss!

  (type < ET_BULLET1) ? enemy.cS = 1 : enemy.cS= 0; // Bullets don't cast shadows, all other enemy types do cast shadows

  enemy.t = type; // Save the type

  setTextureRegion(enemy, getTextureRegion(attributes[EA_TEXTURE_REGION])); // Set texture region

  setPosition(enemy, x, y); // Set the position, even though it might change depending on the type. This is done to save code bytes only

  // 
  // Initialize type specific variables
  // 

  if (type == ET_SCOUT) {

    // 
    // Initialize scout
    // 

    let m = .05 + random() * .05; // Create a random speed (COULD BE SCALED??)
    enemy.distance = MID_WORLD - 192 + rInt (128); // Set random orbit distance
    enemy.angle = rInt(360); // Set random angle on circumference
    (random() < .5) ? enemy.spd = m : enemy.spd = -m; // Set moving clockwise or counter-clockwise
    updateScout(enemy); // Update immediately to make sure the scout is positioned correctly when the wave begins

  } else if (type == ET_AGGRESSOR) {

    // 
    // Initialize Aggressor
    // 

    targetCoordinatesNearPLayer(enemy);

    a = randomAngleRAD(); // Pick a random direction
    setPosition(enemy, PLAYER.x + cos(a) * 200, PLAYER.y + sin(a) * 200);

  } else if (type == ET_BOMBER) {

    // 
    // Initialize Bomber
    // 

    let distance = MID_WORLD - 32, // Distance
    angle = randomAngleDEG(); // Pick a random direction
    enemy.tD = [ // Create two pairs of target coordinates
      {x: MID_WORLD + cos(angle) * distance, y: MID_WORLD + sin(angle) * distance},
      {x: MID_WORLD + cos(angle + PI) * distance, y: MID_WORLD + sin(angle + PI) * distance}
    ];
    enemy.T = enemy.tD[0];
    enemy.T = enemy.tD[0];
    enemy.wT = 0; // Which target (0 or 1)
    enemy.sT = 5 + random() * 5; // Time till a new mine is spawned

    randomizePosition(enemy); // Set random coordinates

    enemy.z = 3; // Set z order do it appears above mines

  } else if (type == ET_CARRIER) {

    // 
    // Initialize Carrier
    // 

    randomizePosition(enemy); // Set random coordinates
    enemy.T = PLAYER;

  } else if (type == ET_ROAMER) {

    // 
    // Initialize Roamer
    // 

    randomizePosition(enemy); // Set random coordinates

    a = randomAngleDEG(); // Pick a random direction
    setVelocities();

    (random() < 0.5) ? enemy.rR = 320 : enemy.rR = -320; // Set moving clockwise or counter-clockwise

  } else if (type == ET_MINE) {

    // 
    // Initialize Mine
    // 
    enemy.mS = 400;
    setVelocities();
    enemy.ttl = 10;

  } else if (type == ET_SWARMER) {
    setVelocities();
    enemy.rot = a;
    enemy.T = PLAYER;

  } else if (type == ET_BULLET1) {
    setVelocities();
    enemy.rot = a;
    enemy.rR = 720;
    enemy.ttl = .9;
    fx_play(FX_BULLET_1);
  
  } else if (type == ET_BULLET2) {
    // enemy.rot = a;
    setVelocities();
    enemy.ttl = 1.5;
    fx_play(FX_BULLET_2);

  } else if (type == ET_BULLET3) {
    setVelocities();
    enemy.rot = a;
    enemy.ttl = 1.5;
    fx_play(FX_BULLET_3);

  } else if (type == ET_MISSILE) {
    setVelocities();
    enemy.rot = a;
    enemy.ttl = 1.5;
    enemy.gpc = 0; // Counter for creating exaust trails
    fx_play(FX_MISSILE);

  }
},

// Give a dog a bone ;)
awardPoints = (n) => {
  playerScore += n; // Increment score
  playerScoreChanged = 1; // Set score changed this frame
},
// Update the player score label
updatePlayerScoreLabel = () => {
  scoreLabel.label = playerScore.toLocaleString(); // Update the label
  scoreLabel.x = centerText(scoreLabel.label); // Center it on the display
  playerScoreChanged= 0; // Set label not changed
},


// #region Initialize New Wave
// Init a new wave
nextWave = () => {

  showCursor(0); // Hide the cursor during gameplay

  resetPool(); // Reset the pool of actors (except the player who never gets recycled)

  logoImage = 0; // Stop sparkles spawning

  generateBackground(); // Generate the background

  let waveIndex = min(WAVE, 9), // Get clamped wave data index

  n = .1 * (waveIndex + 1), // Calculate scalar for making enemies gradually more difficult

  data = waveData[waveIndex], // get the wave data

  // 
  // Spawn player at a random start location
  // 
  
  d = randomSpawnPoint(); // Get a random starting position

  waveScalar = n * n;

  setPosition(PLAYER, d[0], d[1]); // Set position
  PLAYER.rot = d[2]; // Set rotation (always faces towards center of world)

  PLAYER.rR = 0; // Not rotating
  PLAYER.vX = 0; // Not moving
  PLAYER.vY = 0;
  PLAYER.v = 1; // Is visible
  playerCanFire = 1; // Can fire
  playerFiring = 0; // But is not currently firing
  PLAYER.f = 0; // Not flashing
  playerLife = PLAYER_MAX_LIFE; // Reset life to max

  // 
  // Spawn the appropriate number of citizens to be rescued
  // 

  CITIZENS = []; // Empty the list of citizens to be rescued

  citizenCount = data[WD_CITIZEN_COUNT]; // Number of citizens to spawn this wave

  for (let i = 0; i < citizenCount; i++) { // Create this many citizens
    let citizen = getActor(ROLE_CITIZEN); // Get a new actor to represent the citizen
    citizen.cS = 1; // Citizens cast a shadow

    citizen.vX = -5 + random() * 10; // Set citizen moving in a random direction at a random speed
    citizen.vY = -5 + random() * 10;

    citizen.cAF = rInt(5); // Randomize current anim frame
    citizen.nAF = 6; // Number of anim frames
    citizen.aC = 1/8; // roughly 8 frames per second

    citizen.rot = -90; // Correct graphic

    setTextureRegion(citizen, getTextureRegion(TR_CITIZEN)); // Set texture region
    citizen.cR = 6; // Set collision radius

    citizen.rescued = 0;

    randomizePosition(citizen); // Place the citizen at random coordinates

    CITIZENS.push(citizen);
  }
  
  rescuedCount = 0; // Reset number of rescued citizens

  // 
  // Spawn enemies
  // 

  for (let n = 1; n < data.length; n++) { // Range of enemy types to create (ET_SCOUT - ET_ROAMER)
    for (let i = 0; i < data[n]; i++) { // Number of each enemy type to spawn
      newEnemy(n - 1, 0, 0); // Spawn the enemy
    }
  }

  //  
  // Create HUD elements
  // 
  
  scoreLabel = newTextField('', 0, 4); // Create the score label
  updatePlayerScoreLabel(); // Update it

  rescuedLabel = newTextField(`${rescuedCount}/${citizenCount}` , 4, 4); // Create the label displaying how many citizens have been rescued, and how many in total need to be rescued

  doomCounter = TIME_TILL_DOOM; // Reset time till next aggressor is spawned
  doomLabel = newCenteredTextField(`${doomCounter}` , STAGE_SIZE - 13); // Create the label displaying how many seconds before an aggressor is spawned
  doomLabel.z = 10;

  lifeImage = newImage(STAGE_SIZE - 40, 8, TR_LIFE_BAR); // Create life remaining readout
  lifeImage.oX = 72 * playerLife;

  // 
  // Create the indicator that points towards the closest citizen to be rescued
  // 

  greenIndicator = getActor(ROLE_IMAGE);
  setTextureRegion(greenIndicator, getTextureRegion(TR_INDICATOR_GREEN));
  greenIndicator.z = 10;
  setPosition(greenIndicator, STAGE_SIZE / 2, STAGE_SIZE / 2);

  // 
  // The game scene has been composited. Begin the scene fading in
  // 

  transition(0, () => {
    // This code is run when the scene is completely faded in and gameplay can begin
    keysEnabled = 1; // Enable keyboard input
    aiEnabled = 1; // Enable bullet and enemy AI
    collisionEnabled = 1; // Enable collision checks

    showInfo(`Rescue ${citizenCount} citizens`, () => {});
  });
},
// #endregion

// #region User Interfaces
// Fade the menu in, enable button clicking, and show the mouse pointer
showMenu = () => {
  transition(0, () => {
    ui_locked = 0;
    showCursor(1);
  });
},
// Fade the display out, then initialize the required menu (execute its initialization code)
changeMenu = (callback) => {
  fx_play(FX_CLICK); // Click!
  transition(1, () => {
    BUTTONS = []; // Clear list of clickable buttons
    resetPool();
    callback(); // Initialize the manu, creating user interface elements, etc
  });
},
// Create a button that causes the application to go to the main menu
mainMenuButton = () => {
  newButton(64, 219, 128, 'Main Menu', () => { // Main menu button
    if (newHigh) { // Was there a new high score?
      saveScores(); // Save high scores
      newHigh = 0; // Set state to no new high score
      enteringName = 0 // Not entering a name
    }
    helpImages = []; // Clear help images
    controlsChanged = 0;
    awaitingControlKey = 0;

    if (optionsChanged) saveOptions(); // Save options if required
    changeMenu(mainMenu); // Go to the main menu
  });
},
// Initialize and show the help menu
helpMenu = () => {
  logoImage = 0;

  newCenteredTextField('How To PLay', 10, 3)

  newCenteredTextField('Follow the    and rescue the     ', 40);
  newImage(101, 45, TR_INDICATOR_GREEN);

  newImage(216, 45, TR_CITIZEN);

  newCenteredTextField('Avoid or Engage Enemies', 70);

  helpImages = [];

  newTextField('Scout', 15, 105, 2);
  helpImages.push(newImage(32, 130, TR_SCOUT));

  newTextField('Roamer', 73, 105, 2);
  helpImages.push(newImage(96, 130, TR_ROAMER));

  newTextField('Swarmer', 135, 105, 2);
  helpImages.push(newImage(160, 130, TR_SWARMER));

  newTextField('Mine', 205, 105, 2);
  helpImages.push(newImage(220, 130, TR_MINE));

  newTextField('Bomber', 17, 155, 2);
  helpImages.push(newImage(40, 185, TR_BOMBER));

  newTextField('Aggressor', 97, 155, 2);
  helpImages.push(newImage(128, 185, TR_AGGRESSOR));

  newTextField('Carrier', 195, 155, 2);
  helpImages.push(newImage(216, 185, TR_CARRIER));

  mainMenuButton();

  showMenu();
};
// Initialize and show the scores menu
scoresMenu = () => {
  logoImage = 0;

  label = HIGH_SCORE_LABEL;
  if (newHigh) {
    enteringName = 1;
    label = 'New High.. Enter Your Name';
  }
  
  // (newHigh) ? label = 'New High.. Enter Your Name' : label = HIGH_SCORE_LABEL;

  scoreTiteLabel = newCenteredTextField(label, 25, 3)

  let y = 86;

  for (let i = 0; i < SCORES.length; i++) {
    let score = SCORES[i],
    label = newCenteredTextField(`${score.n}  ${score.s.toLocaleString()}`, y, y % 10); // Create a new centered label
    if (score == newScore) newScoreLabel = label; // Save the label for later modification
    y += 17;
  }
  mainMenuButton();

  showMenu();
};
// Stop sparkles spawning
stopSparkles = () => {
  logoImage = 0; // Stop sparkles spawning
},
// Initialize and show the options menu
optionsMenu = () => {

  let initializeControkKeyRemap = (index, button) => {
    if (awaitingControlKey) { // Already waiting for a key remap to occur?
      fx_play(FX_ERROR); // Yes.. just play an annoying error noise
    } else { // Okay to proceed
      fx_play(FX_CLICK);
      setButtonLabel(button, 'Press Key'); // Indicate that this key wants a remap
      controlIndex = index; // Save index and button
      controlButton = button;
      awaitingControlKey = 1; // Set awaiting keypress for new control key mapping
    }
  };

  optionsChanged= 0; // Options don;t need to be saved when this menu closes

  stopSparkles(); // Stop logo sparkle effects

  (OPTIONS.a) ? label = ON_LABEL : label = OFF_LABEL; // Determine which label should be printed

  newCenteredTextField(OPTIONS_LABEL, 11, 3); // Create menu title

  newTextField('Sound Effects', 32, 39);
  audioEnabledButton = newButton(136, 32, 80, label, () => {
    OPTIONS.a = !OPTIONS.a;
    (OPTIONS.a) ? setButtonLabel(audioEnabledButton, ON_LABEL) : setButtonLabel(audioEnabledButton, OFF_LABEL);
    fx_play(FX_CLICK);
    optionsChanged = 1;
  });

  newTextField('Rotate Left', 32, 59);
  controlLeftButton = newButton(16, 71, 104, OPTIONS.c[CONTROL_LEFT].c, () => {
    initializeControkKeyRemap(CONTROL_LEFT, controlLeftButton);
  });

  newTextField('Rotate Right', 150, 59);
  controlRightButton = newButton(136, 71, 104, OPTIONS.c[CONTROL_RIGHT].c, () => {
    initializeControkKeyRemap(CONTROL_RIGHT, controlRightButton);
  });

  newTextField('Forward Thrust', 30, 98);
  controlThrustButton = newButton(16, 110, 104, OPTIONS.c[CONTROL_THRUST].c, () => {
    initializeControkKeyRemap(CONTROL_THRUST, controlThrustButton);
  });

  newTextField('Fire Cheval', 152, 98);
  controlFireButton = newButton(136, 110, 104, OPTIONS.c[CONTROL_FIRE].c, () => {
    initializeControkKeyRemap(CONTROL_FIRE, controlFireButton);
  });

  newTextField('Reverse Thrust', 30, 137);
  controlReverseButton = newButton(16, 149, 104, OPTIONS.c[CONTROL_REVERSE].c, () => {
    initializeControkKeyRemap(CONTROL_REVERSE, controlReverseButton);
  });


  newButton(16, 183, 104, 'Reset Options', () => { // Reset options button
    fx_play(FX_CLICK);
    resetOptions();
    changeMenu(optionsMenu); // Go to the options menmu
  });
  
  newButton(136, 183, 104, 'Reset Scores', () => { // Reset high scores button
    fx_play(FX_CLICK);
    resetHighScores();
  });

  mainMenuButton();
  showMenu();
},
// Initialize and show the main menu
mainMenu = () => {

  starColors = starPalettes[0]; // Set ingame star colors

  logoImage = newImage(128, 61, TR_LOGO); // The SOS logo

  newButton(80, 125, 96, 'New Game', () => { // The "New Game" button
    fx_play(FX_WAVE_BEGIN);
    transition(1, () => { // Execute this code when the scene has transtioned out
      BUTTONS = [];
      WAVE = 0; // Reset the attack wave
      playerScore = 0; // Reset the players score

      starColors = starPalettes[0]; // Set ingame star colors

      nextWave(); // Start the next attack wave
    });
  });
  
  newButton(64, 170, 128, HIGH_SCORE_LABEL, () => { // High scores button
    changeMenu(scoresMenu); // Go to the high scores menu
  });
  
  newButton(32, 215, 88, OPTIONS_LABEL, () => { // Options menu button
    changeMenu(optionsMenu); // Go to the options menmu
  });
  
  newButton(136, 215, 88, 'Help', () => { // Help menu button
    changeMenu(helpMenu); // Go to the help menmu
  });

  showMenu();
}
// #endregion

// #region Asset Generation

// Perform the actual remmaping using the given descriptor
remap = (descriptor, ctx) => {
  palette = palettes[descriptor[6]], // Get the desired palette
  imageData = ctx.getImageData(descriptor[0], descriptor[1], descriptor[2], descriptor[3]), // Get the image data
  data = imageData.data; // Get the actual pixel data

  for (let j = 0; j < data.length; j+=4) {
    let paletteIndex = data[j + 2] - 1; // We only need the blue value
    if (paletteIndex >= 0) { // Skip zero because it's just transparent
      let color = colors[palette[paletteIndex]]; // Get the indexed color
      data[j + 0] = color[0]; // Overwrite existing RGB values with the values from the color
      data[j + 1] = color[1];
      data[j + 2] = color[2];
    }
  }
  ctx.putImageData(imageData, descriptor[4], descriptor[5]); // Draw the recolored region to the atlas

  // 
  // Some descriptors can be used to generate texture regions, saving many bytes of code ;)
  // 

  if (descriptor[7]) { // Push a new texture region?
    textureRegions.push([descriptor[4], descriptor[5], descriptor[3], descriptor[3]]); // Push it!
  }
};

// Generate the TextureAtlas and TextureRegions used for all game assets...
// - Other textures are rendered and recolored as required.
// - The logo will also be drawn using filled polygons and a gradient.
generateAssets = () => {

  ATLAS = newCanvas(728, 256); // The final texture atlas

  let src = D.getElementById('a'), // Source image containing all asset bases

  ctx = ATLAS.ctx; // Destination canvas that will be used for all game rendering

  // #region Render logo

  // 
  // Rendering the logo in code saves a lot of space in the final submission (1601 bytes to be exact)
  // 

  // Draw the given polygon at the given coordinates
  let drawPoly = (shape, x = 0, y = 0) => {
    ctx.moveTo(shape[0] + x, shape[1] + y); // Move to first polygon coordinate
    for (let j = 2; j < shape.length; j+=2) ctx.lineTo(shape[j] + x,shape[j + 1] + y); // Generate polygon lines
    ctx.closePath(); // Close the polygon (make an extra line to connect the last coordinate to first coordinate)
  },
  
  // Draw the logo outline in the given color at the given coordinates
  drawOutline = (color) => {
    ctx.fillStyle = color; // Set the fill color

    ctx.beginPath();
    // NOTE: We draw the outlines multiple times because the HTML5 canvas is unable to render lines that are not antialiased!
    for (let i = 0; i < 3; i++) {

      drawPoly(outerS); // S (left)
      drawPoly(innerS);
      ctx.fill(EVENODD);
    
      drawPoly(outerO1); // O (outer)
      drawPoly(innerO1);
      ctx.fill(EVENODD);
    
      drawPoly(outerO2); // O (inner)
      drawPoly(innerO2);
      ctx.fill(EVENODD);
    
      drawPoly(outerS, 131); // S (right)
      drawPoly(innerS, 131);
      ctx.fill(EVENODD);
    }
  },

  // Set a colorStop in the gradient.
  // NOTE: This function only exists as a minification optimisation
  colorMark=(p,c) => {
    gradient.addColorStop(p, c);
  },

  tempCanvas = newCanvas(1, 80), // Create a new temporary canvas
  tempCtx = tempCanvas.ctx, // Get the drawing context
  gradient = tempCtx.createLinearGradient(0, 0, 0, 88); // Create a new gradient

  colorMark(0, '#73b2ff'); // Set gradients
  colorMark(0.24, '#c2feff');
  colorMark(0.5, '#fff3ff');
  colorMark(0.53, '#2404ca');
  colorMark(0.65, '#4875ff');
  colorMark(1, '#59c8fb');

  tempCtx.fillStyle = gradient; // Set the context to use the gradient for fills
  tempCtx.fillRect(0,0,1,88); // Draw the gradient into the tecanvas
  ctx.fillStyle = ctx.createPattern(tempCanvas, ''); // Set the textureAtlas context to fill using a new pattern created from the gradient

  ctx.beginPath();
  drawPoly(outerS); // S
  ctx.fill();

  drawPoly(outerO1); // O
  drawPoly(innerO2);
  ctx.fill(EVENODD);

  ctx.beginPath(); // Need to reset this, otherwise the O gets its middle bit filled :(
  drawPoly(outerS,131); // S
  ctx.fill();

  ctx.translate(0, 3); // Draw the shadow dropped down 3 pixels
  drawOutline('#444'); // Draw shadow

  ctx.translate(0, -3); // Reverse the drop
  drawOutline('#ddd'); // Draw border

  ctx.drawImage(ATLAS, 0, 0, 214, 91, 512, 0, 214, 91); // Copy the generated logo to it's final location
  ctx.clearRect(0, 0, 214, 91); // Clear the canvas where the logo was initially rendered

  // #endregion

  // 
  // Render the entire base atlas to the canvas
  // Because this image is comprised of very dark blue pixels (#000001 - #000006), it will be used to draw shadows
  // 

  ctx.drawImage(src, 0, 0);
  
  // 
  // Duplicate the escape pod image horizontally so there will be 6 of them for animation purposes
  // 

  for (let i = 1; i < 6; i++) {
    ctx.drawImage(ATLAS, 0,16, 16,16, i * 16,16, 16,16);
  }

  // 
  // Now copy rectangular areas of the atlas to different locations within the same atlas,
  // and use the previously defined palettes to remap the colors of the rectangles.
  // 

  // Create rainbow font
  for (let i = 0; i < 10; i++) {
    let c = rainbow[i]; // Next color
    colors[29] = [c[0], c[1], c[2]]; // Set color
    colors[30] = [floor(c[0] / 3), floor(c[1] / 3), floor(c[2] / 3)]; // Set darker version
    colors[31] = [floor(c[0] / 2), floor(c[1] / 2), floor(c[2] / 2)]; // Set darker version

    remap ([408,16, 8,8, 96 + i * 8,56, 20, 0], ctx); // Sparkle
    remap ([32,32, 480,13, 32,108 + i * 12, 20, 0], ctx); // Font
  }
  
  for (let i = 0; i < remappingDescriptors.length; i++) { // Process all descriptors
    remap(remappingDescriptors[i], ctx); // Remap next rectangular area of the atlas
  }

  // 
  // Overlay the citizen image frames so they appear to be inside the escape pods
  // 

  let frames = [0, 1, 2, 3, 2, 1]; // Animation frames
  for (let i = 0; i < frames.length; i++) { // Process all frames
    ctx.drawImage(ATLAS, frames[i] * 8,96, 8,8, i * 16 + 4,52, 8,8); // Overlay imagery at correct position
  }
  
  // 
  // Draw the life remaining indicator bars at the bottom of thr atlas
  // 
  let x = 0;
  for (let i = 0; i < 10; i++) {
    for (let k = 0; k < i; k++) { // Draw this many blue life units
      ctx.drawImage(ATLAS, 256,48, 8,8, x + (k * 8),248, 8,8);
    }
    for (let j = i; j < 9; j++) { // Draw this many grey life units
      ctx.drawImage(ATLAS, 256,56, 8,8, x + (j * 8),248, 8,8);
    }
    x += 72; // Next image position
  }

  // 
  // Generate some number imagery to be used for particle effects
  // 

  x = 0; // Dest coords 
  let y = 232,
  n = 25; // Number to draw
  for (let i = 0; i < 8; i++) { // Generate this many number images
    ui_renderString(x, y, `${n}`, ctx, 8 - i); // Render the numeric string
    textureRegions.push([x, y, 32, 13]); // Push a new texture region
    x += 32; // Next x psition
    n += 25; // Next number to draw
  }

//  D.body.appendChild(ATLAS); // REM
},
// #endregion

// #region Keyboard Input Handlers (in-game)

// Handle key down events
keyDown = (e) => {
  if (keysEnabled) { // Don't do anything if the keyboard is locked

    showCursor(0); // Hide cursor during gameplay (if it is not already hidden)

    let k = e.keyCode; // Get the key that was pressed or held down

    if ((k == 37) || (k == OPTIONS.c[CONTROL_LEFT].k)) { // Left arrow or user configured key
      PLAYER.rR = -PLAYER_TURN_SPEED;

    } else if ((k == 39) || (k == OPTIONS.c[CONTROL_RIGHT].k)) { // Right arrow or user configured key

      PLAYER.rR = PLAYER_TURN_SPEED;

    } else if (k == OPTIONS.c[CONTROL_THRUST].k) { // User configured key

      playerThrusting = 1; // Player wants to thrust
    
    } else if ((k == 40) || (k == OPTIONS.c[CONTROL_REVERSE].k)) { // Down arrow or user configured key

      playerReversing = 1; // Player wants to reverse

    } else if (k == OPTIONS.c[CONTROL_FIRE].k) { // User configured key

      playerFiring = 1; // Player wants to fire

    }
  }
},
// Handle key up events
keyUp = (e) => {
  k = e.keyCode; // Get the key that was released

  if (keysEnabled) {  // Don't do anything if the keyboard is locked

    // 
    // Process keyup events when the game is running
    // 

    if ((k == 37) || (k == OPTIONS.c[CONTROL_LEFT].k) || (k == 39) || (k == OPTIONS.c[CONTROL_RIGHT].k)) { // Left arrow, right arrow, or user configured keys

      PLAYER.rR = 0; // Stop player rotating

    } else if (k == OPTIONS.c[CONTROL_THRUST].k) { // User configured key

      playerThrusting = 0; // Stop player thrusting
      playerThrustDelay = 0;

    } else if ((k == 40) || (k == OPTIONS.c[CONTROL_REVERSE].k)) { // Down arrow or user configured key

      playerReversing = 0; // Stop player reversing
      playerThrustDelay = 0;

    } else if (k == OPTIONS.c[CONTROL_FIRE].k) { // User configured key

      playerFiring = 0;

    } else if (k == 80) { // p
      paused = !paused; // Toggle paused state
      if (!paused) { // If false, then the game was resumed from a pause state
        lastFrame = Date.now() // Reset elapsed time since last EnterFrame event
        TARGET = PLAYER;
      }
    } else if (k == 79) {
      DEBUG = !DEBUG; // Toggle debug info mode
      if (DEBUG) {

        debugLabel = newTextField('', 4, 20);
      } else {
        freeActor(debugLabel);
      }
    }

  // 
  // Process key up events when the player got a new high score and is entering their name on the high scores menu
  // 

  } else if (enteringName) {

    let n = newScore.n; // Get the name

    if ((k >= 65) && (k <= 90)) { // a to z
      if (n.length < 10) n += e.key; // Append the character if the string length is less than 10 chars
    }

    if ((k == 8) || (k == 46)) { // Backspace or delete
      n = n.slice(0, -1); // Delete last character
    }

    newScore.n = n.toUpperCase(); // Save in uppercase

    label = `${newScore.n}  ${newScore.s.toLocaleString()}`; // Create the label

    newScoreLabel.label = label; // Set the label
    newScoreLabel.x = centerText(label); // Center the label

    if (k == 13) { // Enter or return
      scoreTiteLabel.label = HIGH_SCORE_LABEL; // Set the title back to "High Scores"
      scoreTiteLabel.x = centerText(HIGH_SCORE_LABEL); // Recenter the title
      enteringName= 0; // Not entering a name anymore
    }

  } else if (awaitingControlKey) { // Are we waiting for the player to press a key to remap a control function?
    // Yes! Remap the control
    setButtonLabel(controlButton, e.code);
    OPTIONS.c[controlIndex].c = e.code;
    OPTIONS.c[controlIndex].k = k;
    optionsChanged = 1; // Options will be saved when options menu closed
    awaitingControlKey = 0; // No longer waiting for this event
  }
},
// #endregion 

// #region Enemy

// Make the given actor steer and move towards the given target actor
seek = (actor) => {
  let diff,
  rot = actor.rot * DEGTORAD, // Get actor rotation

  targetAngle = angleTo(actor.T.y - actor.y, actor.T.x - actor.x); // Calculate angle to target coordinates
  
  if (rot != targetAngle) { // Is the actor already facing directly at the target?
    // No... steer towards the target

    actor.fT = 0; // True if actor is facing directly at the target

    diff = targetAngle - rot; // Calculate difference between the current angle and targetAngle
  
    if (diff > PI) diff -= PI2; // Constrain angle (-180 to 180)
    if (diff < -PI) diff += PI2;
  
    (diff > 0) ? rot += actor.tS : rot -= actor.tS; // Turn in the appropriate direction (clockwise or counter-clockwise)
    
    if (abs(diff) < (actor.tS)) { // If the difference is within this margin of error...
      rot = targetAngle; // Set the rotation so the actor will be directlyfacing the target
      actor.fT = 1; // set actor flag so they know that they are in fact directly facing the actor
    }
  }
  actor.vX = cos(rot) * actor.mS; // Set new velociy
  actor.vY = sin(rot) * actor.mS;
  
  actor.rot = rot * RADTODEG; // Save rotation in degrees
},
angleTo = (a, b) => {
  return atan2(a, b);
},
// Get the distance between the two given coordinates
distanceBetween =(a, b) => {
  return M.hypot(a.x - b.x, a.y - b.y);
},
// Return true if the given actors are within the given distance
inRange = (a, b, d) => {
  return distanceBetween(a, b) < d;
},
// If the player is in range of the given actor and it can fire, fire on the player, otherwise countdown until it can fire again
fire = (actor, callback) => {
  if ((inRange(actor, PLAYER, actor.R))) {
    if (actor.cF) { // Can the actor fire?
      // YES! Fire!!
      callback();
      actor.cF = 0; // Can not fire
      actor.rC = actor.rD; // Reset reloading counter
    } else {
      if ((actor.rC -= DT) <= 0) { // Reloaded?
        actor.cF = 1; // Can fire next frame
      }
    }
  }
},
// If the given actor is a carrier, release a swarm of swarmers when it dies (+1 for Red Alert quote??)
releaseTheSwarm = (actor) => {
  if (actor.t == ET_CARRIER) {
    fx_play(FX_SWARM_WARNING);
    let angle = angleTo(PLAYER.vY, PLAYER.vX) * RADTODEG % 360;
    for (let j = 0; j < 6; j++) {
      newEnemy(ET_SWARMER, actor.x, actor.y, angle - 60 + rInt(120));
    }
  }
},

// #endregion

// Spawn a particle using the given parameters
newParticle = (ttl, x, y, direction, speed, fades, alpha, shrinks, scale, rotRate, region, frames, z = 0) => {
  let p = getActor(ROLE_PARTICLE);// Create a new particle actor

  p.ttl = ttl; // Time to live
  p.gpc = ttl; // Copy of above that is used for counting down

  p.rot = direction; // Rotation
  p.rR = rotRate;// Rotation rate

  p.vX = cos(direction * DEGTORAD) * speed; // Set valocity
  p.vY = sin(direction * DEGTORAD) * speed;

  p.x = x, // Position
  p.y = y,

  p.fa = fades; // Fading settings
  p.a = alpha;
  p.a2 = alpha;

  p.sh = shrinks; // Shrinking settings
  p.s = scale;
  p.s2 = scale;

  setTextureRegion(p, region); // Set texture region
  p.iX = region[0]; // Save region x coordinate for animation purposes
  p.frames = frames; // Number of animation frames

  p.z = z; // Drawing priority
},
// Update the indicator that indicates the direction to the closest citizen
updateGreenIndicator = () => {
  if (greenIndicator && CITIZENS.length > 0) {
    let d,
    distance = 9999,
    closest = 0,
    citizen,

    px = clamp(PLAYER.x, LEFTEDGE, RIGHTEDGE),
    py = clamp(PLAYER.y, LEFTEDGE, RIGHTEDGE);

    for (let i = 0; i < CITIZENS.length; i++) {
      citizen = CITIZENS[i];
      if (!citizen.rescued) {
        d = distanceBetween(PLAYER, citizen); // Get distance between two positions
        if (d < distance) { // Is this citizen closer to the player?
          distance = d; // Save the new shortest distance
          closest = citizen; // Save the new closest citizen
        }
      }
    }
    if (closest) { // Make sure there is something close (not the case when all citizens have been rescued)
      d = angleTo(closest.y - py, closest.x - px); // Calculate the angle from the player to the closest citizen
      greenIndicator.v = (!onScreen(closest)); // Make the indicator invisible if the closest citizen is visible to the player
      greenIndicator.x = 128 + cos(d) * 116; // Update the indicators position
      greenIndicator.y = 128 + sin(d) * 116;
      // setTextureRegion(greenIndicator, getTextureRegion(TR_AGGRESSOR));
      // log(greenIndicator);
    }
  }
},
// Spawn some one-shot animated explosions of varied sizes about the given actors coordinates
explodeActor = (actor) => {
  if (actor.eE > 0) {
    let data = explosionEffects[actor.eE - 1],
    spread = data[1];
    
    for (let i = 0; i < data[0]; i++) { // Spawn this many particles
      newParticle(
        .2, // ttl
        actor.x - spread + rInt(spread * 2), // x
        actor.y - spread + rInt(spread * 2), // y
        0, // direction
        0, // speed
        0, // fades
        1, // alpha
        0, // shrinks
        1 + (random() * .5), // scale
        0, // rotRate
        getTextureRegion(data[2]), // TextureRegion
        4 // Frames
      );
    }

    if ((actor.r == ROLE_ENEMY) && (actor.t <= ET_SWARMER)) { //' Is the enemy NOT a bullet?
      let a = randomAngleDEG(), // Pick a random start angle
      o = rInt(9) * 8; // Random x offset for different colored particles
      for (let j = 0; j < 8; j++) { // Spawn this many particles in a circular spread
        newParticle(
          .35, // ttl
          actor.x, // x
          actor.y, // y
          a, // direction
          90, // speed
          0, // fades
          1, // alpha
          1, // shrinks
          2 + random(), // scale
          0, // rotRate
          [96 + o, 56, 8, 8], // TextureRegion
          0 // Frames
        );
        a += 45;
      }
    }

    if (onScreen(actor)) fx_play(data[3]); // Play effect if the actor is visible to the player
  }
},
// Decrement given actors time to live and when it reaches zero... make it explode using its explosion effect
expireActor = (actor) => {
  if (( actor.ttl -= DT) <= 0) { // Expired?
    explodeActor(actor); // Explode!
    freeActor(actor); // Recycle
  }
},
// Add the given actors velocity to its coordinates
applyVelocities = (actor) => {
  actor.x += actor.vX * DT; // Update actor x position
  actor.y += actor.vY * DT; // Update actor y position
},
// Update the position of the given actor, and constrain it to stay inside the defined world boundaries
moveAndConstrain = (actor) => {

  applyVelocities(actor); // Apply the actors velocities to its coordinates

  if (actor.x - actor.rX < 0) { // Constrain on x axis, bouncing off left and right edges of world
    actor.x = actor.rX;
    actor.vX = -actor.vX;
  } else if (actor.x + actor.rX > WORLD_SIZE) {
    actor.x = WORLD_SIZE - actor.rX;
    actor.vX = -actor.vX;
  }
  
  if (actor.y - actor.rY < 0) {  // Constrain on x axis, bouncing off top and bottom edges of world
    actor.y = actor.rY;
    actor.vY = -actor.vY;
  } else if (actor.y + actor.rY > WORLD_SIZE) {
    actor.y = WORLD_SIZE - actor.rY;
    actor.vY = -actor.vY;
  }
},
// Draw the given actor to the display as a shadow, or as the actual image
drawActor = (actor, shadow = 0) => {

  // Draw a circle centered on the actor with the given radius and given color
  let circle = (r, c) => {
    CTX.strokeStyle = c;
    CTX.beginPath();
    CTX.arc(0, 0, r, 0, PI2);
    CTX.stroke();
  };

  if (actor.v) { // Only draw if the actor is visible

    let r = actor.tR, // Get texture region

    lX = floor(actor.lX), // get local coordinates
    lY = floor(actor.lY),
  
    rotation = actor.rot + 90; // Because I'm too lazy to rotate all of my images in GIMP :D
  
    CTX.save(); // Save context state
  
    if (shadow) { // Do we just want to draw a shadow?
      
      // 
      // Draw a shadow
      // 

      CTX.globalAlpha = .25 * transitionAlpha;
      CTX.translate(lX - 4 , lY + 4); // Apply transformations
      CTX.rotate(DEGTORAD * rotation);
      
      drawMain(r[0], r[1] - 32, r[2], r[3], -actor.rX, -actor.rY);
  
    } else {

      // 
      // Draw the actual image
      // 

      CTX.globalAlpha = actor.a * transitionAlpha; // Set alpha
   
      if (actor.r > ROLE_BUTTON) {
        
        // 
        // Draw particle, enemy, bullet, player, or citizen
        // 

        CTX.translate(lX, lY); // Apply transformations
        CTX.scale(actor.s, actor.s);
  
        CTX.rotate(DEGTORAD * rotation);
        drawMain(r[0] + actor.oX, r[1] + actor.oY, r[2], r[3], -actor.rX, -actor.rY);

        if ((DEBUG) && (actor.r == ROLE_ENEMY)) { // Is debug enabled, AND is the actor an enemy?
          if (actor.t <= ET_SWARMER) { // we only want actual enemies, not enemy bullets

            if (actor.T) { // Current target

              let a = angleTo(actor.T.y - actor.lY, actor.T.x - actor.lX) - 90, // Calculate angle to target coordinates
              d = distanceBetween(actor, actor.T);

              CTX.strokeStyle = '#ff0';
              CTX.beginPath();
              CTX.moveTo(0, 0);
              CTX.lineTo(cos(a * DEGTORAD) * d, sin(a * DEGTORAD) * d);
              CTX.closePath();
              CTX.stroke();
            }

            circle(actor.cR, '#08f'); // Draw a circle centered on the actor wth a radius of its collision radius

            circle(actor.R, '#f00'); // Draw a circle centered on the actor wth a radius of its targeting range
          }
        }

      } else if (actor.r == ROLE_TEXTFIELD) {

        // 
        // Draw a text field
        // 

        ui_renderString(actor.x, actor.y, actor.label, CTX, actor.c); // Render the string into the canvas

      } else if (actor.r == ROLE_IMAGE) {

        // 
        // Draw an image
        // 

        CTX.translate(actor.x, actor.y); // Apply transformations
        CTX.rotate(DEGTORAD * (rotation - 90)); // Unrotate for images
        drawMain(r[0] + actor.oX, r[1] + actor.oY, r[2], r[3], -r[2] / 2, -r[3] / 2);

      // } else { // It has to be a button
      } else if (actor.r == ROLE_BUTTON) {

        // 
        // Draw a button
        // 

        let x = actor.x, // Get coordinates
        y = actor.y,
        o = 0;

        if (ui_selected == actor) o = 1; // Pressed buttons are moved one pixel right and down for uber visual effect ;)

        CTX.drawImage(actor.i, r[0], r[1], r[2], r[3], x + o, y + o, r[2], r[3]); // Draw the image to the display
      }
    }
    CTX.restore(); // Restore context state
  }
},

// 
// Main game logic loop is here
// 

// #region EnterFrame Event - The main game loop

// Update engine state fps times per second
onEnterFrame = () => {

  let vL, vR, vT, vB, // Viewport bounds
  
  shadowList = [], // List of shadows to be rendered (required so that shadows do not overlap particles)
  actor,
  other,
  ratio,

  // 
  // Define utility functions
  // 

  // Determine if the given actor is visible and needs to be considered when rendering the scene (and colliding with the player)
  drawOrNot = (actor) => {
    if (actor.v) {

      if (actor.r >= ROLE_CITIZEN) { // Only actors with a role higher than this value will be considered for collision detection
        if (actor.A) { // Only process alive actors
          // The collision list can only contain actors that can actually collide with the player, nothing else.
          if ((actor.x - actor.rX < vR + 128) && (actor.x + actor.rX > vL - 128) && (actor.y - actor.rY < vB + 128) && (actor.y + actor.rY > vT - 128)) { // Is the actor inside the defined collision area?
            collisionList.push(actor); // Add to collision list
          }
        }
      }
      actor.lX = 0; // Set off screen
      if (actor.r < ROLE_PARTICLE) {
        renderList.push(actor); // Add actor to the list of actors that will need to be rendered this frame
        
      } else {
        if ((actor.x - actor.rX < vR) && (actor.x + actor.rX > vL) && (actor.y - actor.rY < vB) && (actor.y + actor.rY > vT)) { // Is the actor inside the visible area?
          actor.lX = actor.x - vL; // Calculate actors local coordinates
          actor.lY = actor.y - vT;
          renderList.push(actor); // Add actor to the list of actors that will need to be rendered this frame
          if (actor.cS) shadowList.push(actor); // Add to list of shadows to draw
        }
  
      }
    }
  },
  // Return true if the given axis aligned bounding boxes (AABB) overlap
  collides =(a, b) => {
    return a.x - a.cR < b.x + b.cR && a.x + a.cR > b.x - b.cR && a.y - a.cR < b.y + b.cR && a.y + a.cR > b.y - b.cR; // boobooleboo
  },
  // Check if the current actor is colliding with any other actor with the given role, and if so, execute the passed function
  collider = (role, callback) => {
    for (let i = 0; i < collisionList.length; i++) {
      other = collisionList[i];
      if (other.r == role) { // Only check others with the given role
        if (other.A) { // Only check alive others
          if (collides(actor, other)) { // Do the two actors overlap?
            callback(); // If so, run this code
            return;
          }
        }
      }
    }
  };

  if (!paused) { // Only run code if not paused

    // 
    // Calculate time in seconds since last EnterFrame event
    // 

    thisFrame = Date.now();
    DT = thisFrame - lastFrame; // Difference in seconds between this EnterFrame event and the previous one
    lastFrame = thisFrame;
    DT /= 1000; // Time elapsed (in seconds) since the last EnterFrame event

    // 
    // The main logic begins here
    // 

    // #region Player Collision
    if (collisionEnabled) {

      // 
      // This next part is not player related but mashed in here so it doesn;t happen when a menu is visible :D
      // 

      if ((doomCounter -= DT) < 0) { // Is it time for aggression?
        doomCounter += DOOM_DELAY; // Set time till next aggressor spawn
        newEnemy(ET_AGGRESSOR, 0, 0); // Oh yeah...
        fx_play(FX_AGGRESSOR_ALERT); // It's aggressor time!
      }
     doomLabel.label = `${floor(doomCounter)}`;

      // 
      // Player processing starts here
      // 

      for (let i = 0; i < renderList.length; i++) { // Process all actors
        other = renderList[i]; // The possible collider

        // NOTE: We are using renderList because the player can ONLY possibly collide with
        // things that are close, ie; actors that are contained in the renderList.
  
        if (other.r >= ROLE_CITIZEN) { // Only check collisions with citizens and enemies
  
          if (collides(PLAYER, other)) { // Did the payer collide with this actor?

            if (other.r == ROLE_CITIZEN) { // Did the player collide with a citizen?
  
              // 
              // Player collided with a citizen. Rescue that little guy!
              // 
  
              other.rescued = 1; // set citizen state to "rescued"
  
              newParticle( // Spawn a particle using the citizen imagery that just shoots off the top of the display quickly
                .5, // ttl
                other.x, // x
                other.y,
                -90, // direction
                500, // speed
                0, // fades
                1, // alpha
                0, // shrinks
                1, // scale
                0, // rotRate
                getTextureRegion(TR_CITIZEN), // TextureRegion
                0 // Frames
              );
  
              awardPoints(200); // Award the player points for rescuing the citizen

              newParticle(
                1, // ttl
                other.x, // x
                other.y, // y
                -90, // direction
                15, // speed
                1, // fades
                1, // alpha
                0, // shrinks
                1, // scale
                0, // rotRate
                getTextureRegion(TR_200), // TextureRegion
                0 // Frames
              );

              if (playerLife < PLAYER_MAX_LIFE) { // Add a life point if player life is less than max
                playerLife ++; // add life
                lifeImage.oX = playerLife * 72; // Set atlas x offset
              }
              //  else {
              //   // TODO - Award a bonus?
              // }
            
              // 
              // Check if the wave completed condition is met (all citizens rescued)
              // 
  
              rescuedCount ++; // Add one to the number of rescued citizens
              rescuedLabel.label = `${rescuedCount}/${citizenCount}`; // Update displayed number of rescued citizens
              if (rescuedCount == citizenCount) { // Have all citizens been rescued?
  
                // 
                // Wave complete condition has been met so cleanup and display the wave complete stats
                // 
  
                disableEverything();
  
                newParticle( // Create a new particle using the player imagery that shoots off the display in the direction the player is currently facing
                  2, // ttl
                  PLAYER.x, // x
                  PLAYER.y, // y
                  PLAYER.rot, // direction
                  500, // speed
                  0, // fades
                  1, // alpha
                  0, // shrinks
                  1, // scale
                  0, // rotRate
                  getTextureRegion(TR_PLAYER), // TextureRegion
                  0 // Frames
                );
                fx_play(FX_WAVE_END);

                // 
                // Display wave complete message. After it has faded out, the next wave will be initiated
                // 

                showInfo(`WAVE ${WAVE + 1} COMPLETE`, () => {
                  fx_play(FX_WAVE_BEGIN);
                  transition(1, () => { // Execute this code when the scene has transtioned out
                    WAVE ++;
                    nextWave(); // Start the next attack wave
                  });
                });

              } else { // The wave is not complete so just play the rescue sound effect
  
                fx_play(FX_RESCUED); // Play the rescue sound effect
              }
  
            } else {
  
              // 
              // Player collided with an enemy
              // 
  
              if (!PLAYER.f) { // Is the player currently flashing?

                // While the player is flashing, they cannot be damaged

                playerLife --; // Subtract life

                fx_play(FX_HIT);
                
                lifeImage.oX = playerLife * 72; // Set atlas x offset

                if (playerLife <= 0) {

                  DEBUG= 0; // Disable debug output

                  fx_play(FX_GAME_OVER);

                  showInfo(`Game Over`, () => {
                    fx_play(FX_WAVE_BEGIN);
                    transition(1, () => { // Execute this code when the scene has transtioned out
                      BUTTONS = []; // Clear list of clickable buttons
                      resetPool();

                      clearBackGround();

                      if (playerScore > SCORES[SCORES.length - 1].s) {
                        newHigh = 1; // Let the scores menu know that the player got a new high score
                        SCORES.length = 4; // Truncate the last one
                        newScore = addNewScore('', playerScore); // Add the new score and keep a reference to it
                      }

                      scoresMenu();
                    });
                  });

                  // 
                  // Initialize game over scene
                  // 

                  disableEverything();

                  let dummy = getActor(ROLE_IMAGE)
                  setPosition(dummy, PLAYER.x, PLAYER.y);
                  dummy.eE = 5;
                  explodeActor(dummy);

                } else {

                  flash(PLAYER); // Make the player flash to signify it is taking damage
                  if (other.t < ET_BULLET1) { // Did the player collide with an enemy that is NOT a bullet?
                    explodeActor(other); // Spawn explosion effects for the enemy that the player colided with

                    releaseTheSwarm(other);

                    PLAYER.vX = -PLAYER.vX; // Reverse the players velocities.. dirty but looks okay
                    PLAYER.vY = -PLAYER.vY;
                  }
                }
                
              } // Player flashing check
            } // Player collision type check

            freeActor(other); // Remove the actor that the player collided with, regardless of its role
          } // Collision check
        } // Type check
      } // Collision loop
    } // Collision enabled check
    // #endregion

    // #region Player Firing
    if (playerCanFire) { // Can the player fire?
      if (playerFiring) { // Only fire if the SPACE key is being held
        playerReloadCounter = PLAYER_RELOAD_DURATION; // Set reload delay
        playerCanFire = 0; // Set player reloading

        // Spawn a new player bullet at the players coordinates, moving in the direction that the player is facing
        let bullet = getActor(ROLE_BULLET); // Create a new player bullet actor

        setPosition(bullet, PLAYER.x, PLAYER.y); // Mirror player coordinates
        bullet.vX = cos(PLAYER.rot * DEGTORAD) * PLAYER_BULLET_SPEED; // Set velocity
        bullet.vY = sin(PLAYER.rot * DEGTORAD) * PLAYER_BULLET_SPEED;
        bullet.rot = PLAYER.rot; // Mirror rotation
        bullet.ttl = PLAYER_BULLET_TTL; // Set time till it dies
        bullet.cR = 1; // Collision radius
        bullet.z = 1; // Drawing priority
        bullet.eE = 4;
        setTextureRegion(bullet, getTextureRegion(TR_PLAYERBULLET)); // Set texture region
        fx_play(FX_PLAYER_BULLET); // "pew pew"

      }
    } else { // The player is reloading
      if ((playerReloadCounter -= DT) <= 0) playerCanFire = 1; // If the counter is equal to or less than 0, the player can fire another bullet
    }
    // #endregion

    // #region Player Movement

    PLAYER.rot += PLAYER.rR * DT; // Update player rotation

    if (playerThrusting || playerReversing) {
      let multiplier = 1,
      m2 = 1;
      if (playerReversing) {
        multiplier = -.5;
        m2 = -1;
      }
      
      PLAYER.vX = clamp(PLAYER.vX + cos(PLAYER.rot * DEGTORAD) * (4 * multiplier) , -PLAYER_MAX_VELOCITY, PLAYER_MAX_VELOCITY); // Increment velocity in the direction that the player is facing
      PLAYER.vY = clamp(PLAYER.vY + sin(PLAYER.rot * DEGTORAD) * (4 * multiplier), -PLAYER_MAX_VELOCITY, PLAYER_MAX_VELOCITY);

      if ((playerThrustDelay -= DT) < 0) { // Spawn thrust particles at regular intervals
        playerThrustDelay = 0.025; // Time between thrust particle emissions
        newParticle(
          .35, // ttl
          PLAYER.x - 2 + rInt(4), // x
          PLAYER.y - 2 + rInt(4), // y
          PLAYER.rot + 180 * m2, // direction
          150 * m2, // speed
          1, // fades
          1, // alpha
          1, // shrinks
          1 * multiplier, // scale
          0, // rotRate
          getTextureRegion(TR_THRUST), // TextureRegion
          0 // Frames
        );
        fx_play(FX_THRUST);
      }


    }
    // if (playerReversing) { // Is the player reversing?
    //   PLAYER.vX = clamp(PLAYER.vX + cos(PLAYER.rot * DEGTORAD) * -8, -PLAYER_MAX_VELOCITY, PLAYER_MAX_VELOCITY); // Increment velocity in the direction that the player is facing
    //   PLAYER.vY = clamp(PLAYER.vY + sin(PLAYER.rot * DEGTORAD) * -8, -PLAYER_MAX_VELOCITY, PLAYER_MAX_VELOCITY);

    // } else if (playerThrusting) { // Is the player thrusting?
    //   PLAYER.vX = clamp(PLAYER.vX + cos(PLAYER.rot * DEGTORAD) * 4, -PLAYER_MAX_VELOCITY, PLAYER_MAX_VELOCITY); // Increment velocity in the direction that the player is facing
    //   PLAYER.vY = clamp(PLAYER.vY + sin(PLAYER.rot * DEGTORAD) * 4, -PLAYER_MAX_VELOCITY, PLAYER_MAX_VELOCITY);

    //   if ((playerThrustDelay -= DT) < 0) { // Spawn thrust particles at regular intervals
    //     playerThrustDelay = 0.025; // Time between thrust particle emissions
    //     newParticle(
    //       .35, // ttl
    //       PLAYER.x - 2 + rInt(4), // x
    //       PLAYER.y - 2 + rInt(4), // y
    //       PLAYER.rot + 180, // direction
    //       150, // speed
    //       1, // fades
    //       1, // alpha
    //       1, // shrinks
    //       1, // scale
    //       0, // rotRate
    //       getTextureRegion(TR_THRUST), // TextureRegion
    //       0 // Frames
    //     );
    //     fx_play(FX_THRUST);
    //   }
    // }
    moveAndConstrain(PLAYER); // Update the players world position, and keep them from leaving the game worlds defined boundaries

    doFlash(PLAYER); // Flash the player if it is flashing

    // #endregion

    // 
    // Update game state based on results of previous frame
    // 

    for (let i = 0; i < OUT.length; i++) { // Process all actors
      actor = OUT[i]; // Next actor

      if (actor.r == ROLE_PARTICLE) {

        // 
        // Process particle
        // 

        actor.x += actor.vX * DT; // Update position
        actor.y += actor.vY * DT;
        ratio = 1/actor.ttl * actor.gpc; // Scaling ratio
        if (actor.fa) actor.a = actor.a2 * ratio; // Scale alpha
        if (actor.sh) actor.s = actor.s2 * ratio; // Scale size
        if (actor.frames > 0) setTextureRegion(actor, [actor.iX + (actor.tR[2] * clamp(actor.frames - floor(actor.frames * ratio) - 1, 0, actor.frames - 1)), actor.tR[1], actor.tR[2], actor.tR[3]]); // Don't ask. Just accept that this code animates a particle over time, and move on with your life :D
        if ((actor.gpc -= DT) <= 0) freeActor(actor) // If the ttl reaches 0 or below, just recycle the actor, effectively removing it from the scene

      } else if (actor.r == ROLE_ENEMY && aiEnabled) {
        
        // 
        // Process enemy actors
        // 

        if (actor.t == ET_SCOUT) {

          // 
          // Perform AI for ET_SCOUT enemy actors
          // 

          updateScout(actor);
          fire(actor, () => { // Fire at the player
            newEnemy(ET_BULLET1, actor.x, actor.y, angleTo(PLAYER.y - actor.y, PLAYER.x - actor.x) * RADTODEG // Calculate angle to target coordinates
            );
          });
          
        } else if (actor.t == ET_AGGRESSOR) {

          // 
          // Perform AI for ET_AGGRESSOR enemy actors
          // 
          
          
          seek(actor); // Steer the actor towards the target coordinates and update velocity
          applyVelocities(actor); // Move it!
          
          if (inRange(actor, actor.T, 8)) targetCoordinatesNearPLayer(actor); // If the actor is "close" to the current target, create a new one
          fire(actor, () => { // Fire at the player
            newEnemy(ET_MISSILE, actor.x, actor.y, angleTo(PLAYER.y - actor.y, PLAYER.x - actor.x) * RADTODEG // Calculate angle to target coordinates
            );
          });

        } else if (actor.t == ET_BOMBER) {

          // 
          // Perform AI for ET_BOMBER enemy actors
          // 


          seek(actor); // Steer the actor towards the target coordinates and update velocity
          moveAndConstrain(actor); // Move it!
          
          if (inRange(actor, actor.T, 8)) actor.wT ++; // If the actor is "close" to the current target, switch to the other target
          
          actor.T = actor.tD[actor.wT % 2]; // Get the current target coordinates (0 or 1)

          if ((actor.sT -= DT) <= 0) { // Can the actor spawn a new mine?
            actor.sT = 5 +random() * 5; // Reset spawn timer
            newEnemy(ET_MINE, actor.x, actor.y, (actor.rot - 90) + rInt(180)); // Spawn a new mine
            if (onScreen(actor)) fx_play(FX_MINE); // Play the mine spawning sound if the actor is visible to the player
          }
      
        } else if (actor.t == ET_CARRIER) {

          // 
          // Perform AI for ET_CARRIER enemy actors
          // 

          seek(actor); // Steer the carrier towards the target coordinates and update velocity
          moveAndConstrain(actor); // Move it!
          if (actor.fT) { // Is the carrier directly facing the player?
            fire(actor, () => { // Fire at the player
              newEnemy(ET_BULLET3, actor.x - 5 + rInt(10), actor.y - 5 + rInt(10), actor.rot);
            });
          }
              
        } else if (actor.t == ET_ROAMER) {

          // 
          // Perform AI for ET_ROAMER enemy actors
          // 

          moveAndConstrain(actor);
          fire(actor, () => { // Fire at the player
            newEnemy(ET_BULLET2, actor.x , actor.y, randomAngleDEG());
          });

        } else if (actor.t == ET_MINE) {
          moveAndConstrain(actor);
          actor.vX *= .8; //Slow mine
          actor.vY *= .8;
          expireActor(actor);

        } else if (actor.t == ET_SWARMER) {

          // 
          // Perform AI for ET_SWARMER enemy actors
          // 

          seek(actor); // Steer the actor towards the target coordinates and update velocity
          applyVelocities(actor);

        } else { // It must be ET_BULLET1, ET_BULLET2, and ET_BULLET3
          // All enemy bullets just travel in a straight line at their velocity until they expire, or collide with the player
          applyVelocities(actor);

          if (actor.t == ET_MISSILE) {
            newParticle(
              .1, // ttl
              actor.x - 1 + rInt(2), // x
              actor.y - 1 + rInt(2), // y
              actor.rot + 180, // direction
              150, // speed
              1, // fades
              1, // alpha
              1, // shrinks
              .5, // scale
              0, // rotRate
              getTextureRegion(TR_THRUST), // TextureRegion
              0 // Frames
            );
          }
          expireActor(actor);
        }
 
      } else if (actor.r == ROLE_BULLET && aiEnabled) {

        // 
        // Process player bullet AI
        // Player bullets move forward at their set velocities and collide with enemies.
        // 

        if ((actor.ttl -= DT) <= 0) { // Expired?
          explodeActor(actor); // Spawn explosion effects
          freeActor(actor); // Recycle
        } else { // The bullet is still alive

          applyVelocities(actor); // Move the bullet
          collider(ROLE_ENEMY, () => { // Check for and resolve collisions between player bullets and enemies
            collisionList.splice(collisionList.indexOf(other), 1); // Remove actor from list
            explodeActor(other); // Spawn explosion effects

            awardPoints(other.pV); // Add to player Score

            if (other.pI > 0) {
              newParticle(
                1, // ttl
                other.x, // x
                other.y, // y
                -90, // direction
                15, // speed
                1, // fades
                1, // alpha
                0, // shrinks
                1, // scale
                0, // rotRate
                getTextureRegion(other.pI), // TextureRegion
                0 // Frames
              );
            }

            releaseTheSwarm(other);
            freeActor(other); // Recycle actors
            freeActor(actor);
          });
        }

      } else if (actor.r == ROLE_CITIZEN) {

        // 
        // Process citizen AI
        // 

        if ((actor.aC -= DT) <= 0) { // Ready to advace the frame?
          actor.aC += 1/8; // Reset counter till next frame change
          actor.cAF += 1; // Increment animation frame
          if (actor.cAF == actor.nAF) actor.cAF = 0; // Reset to the first frame if it reached the last frame
          actor.oX = actor.cAF * 16; // Next frame
        }
        moveAndConstrain(actor); // Move
      }

      // 
      // Perform actions common to all actors
      // 

      actor.rot += actor.rR * DT; // Update rotation
    }

    // 
    // Update HUD elements
    // 

    updateGreenIndicator(); // Update indicator pointing towards closest citizen to be rescued

    if (playerScoreChanged) updatePlayerScoreLabel(); // Update score label if required

    if (infoVisible) { // Is the info label being displayed?
      infoCounter -= DT; // Decrement counter
      infoLabel.a = infoCounter; // Set the alpha of the label so it fades out
      if (infoCounter <= 0) { // Is the label completely faded out?
        infoCallback(); // Run code
        freeActor(infoLabel); // Recycle label
        infoVisible= 0; // Intro complete
      }
    }

    // 
    // If the help menu is open, rotate the enemy images
    // 

    if (helpImages.length > 0) {
      for (let i = 0; i < helpImages.length; i++) {
        helpImages[i].rot += 1.1;
      }
    }

    // 
    // Change star colors randomly when menus are visible
    // 

    if (BUTTONS.length > 0) {
      if ((starCounter -= DT) < 0) {
        starCounter = 0.25; // Reset countdown
        starColors = starPalettes[rInt(2) + 1]; // Change the colors
      }
    }

    // 
    // Make some sparkle effects in the logos general vicinity
    // 

    if (logoImage) {
      if ((sparkleCounter -= DT) < 0) {
        sparkleCounter = random() * 2;

        newParticle(
          .5, // ttl
          logoImage.x - logoImage.tR[2] / 2 + rInt(logoImage.tR[2]), // x
          logoImage.y - logoImage.tR[3] / 3 + rInt(logoImage.tR[3] * .6), // y
          randomAngleDEG(), // direction
          0, // speed
          1, // fades
          1, // alpha
          1, // shrinks
          1, // scale
          640, // rotRate
          getTextureRegion(TR_SPARKLE), // TextureRegion
          0, // Frames
          10
        );
      }
    }
    
    // 
    // Render the game scene...
    // 1 - Calculate viewport coordinates (centered around player).
    // 2 - Determine which actors are within the viewport and will be drawn this frame.
    // 3 - Clear the stage, filling it with the background color
    // 4 - Draw all stars, after updating their positions.
    // 5 - Draw the visible area of the background.
    // 6 - Draw all shadows.
    // 7 - Draw all visible actors based on their sorted z order.
    // 

    // 
    // 1 - Calculate the global and local world coordinates, centered about the actor that the camera is currently tracking
    // 

    vL = floor(clamp(TARGET.x - 128, 0, WORLD_SIZE - STAGE_SIZE)), // Get visible bounds of game world
    vT = floor(clamp(TARGET.y - 128, 0, WORLD_SIZE - STAGE_SIZE)),
    vR = vL + STAGE_SIZE,
    vB = vT + STAGE_SIZE;

    // 
    // 2 -Determine which actors will be considered for rendering this frame, and which will be checked for collisions next frame
    // 

    renderList = []; // Empty the list of actors to be rendered this frame
    collisionList = []; // Empty the list of actors that can collide this frame

    for (let i = 0; i < OUT.length; i++) { // Process all actors
      actor = OUT[i];
      if (actor.r <= ROLE_BUTTON) { // Actors with roles lower than ROLE_BUTTON are considered HUD elements and will always be drawn
        renderList.push(actor); // Always add these
        
      } else {

        drawOrNot(actor); // Determine if the actor will be drawn, and if it will have collision checking performed on it

      }
    }
    drawOrNot(PLAYER); // Determine if the player will be drawn. Could use "renderList.push(PLAYER)" but drawOrNot(PLAYER) is less code :D
    
    // 
    // 3 - Clear the stage
    // 

    CTX.globalAlpha = 1; // For the clear we want no transparency
    CTX.fillStyle = '#001'; // Set background color
    CTX.fillRect(0, 0, STAGE_SIZE, STAGE_SIZE); // Fill it

    // 
    // 4 - Update parallax star positions and draw them
    // 

    CTX.globalAlpha = transitionAlpha; // All stars usethe global alpha (actors use their own, multiplied by this variable)

    let n = 0;
    while (n < STARS.length) { // NOTE: While loops are actually smaller code than a for loop. I dunno about performance impacts though
      let s = STARS[n], // Next star
      x = s[0], // Get star coordinates
      y = s[1],
      z = floor((3 / 144) * n++); // The layer (0-2)

      CTX.fillStyle = starColors[z++]; // Set the fill color that corresponds to the stars layer (distance in space).

      x += -PLAYER.vX * .4 * z * DT; // Update x position
      if (x <= 0) x += STAGE_SIZE; // Wrap left
      if (x >= STAGE_SIZE) x -= STAGE_SIZE; // Wrap right

      y += -PLAYER.vY * .4 * z * DT; // Update y position
      if (y <= 0) y += STAGE_SIZE; // Wrap top
      if (y >= STAGE_SIZE) y -= STAGE_SIZE; // Wrap bottom

      s[0] = x; // Save updated coordinates
      s[1] = y;

      CTX.fillRect(floor(x), floor(y), 1, 1); // Draw the star
    }

    //
    // 5 - Overlay the visible area of the background
    //

    CTX.drawImage(BACKGROUND_CANVAS, clamp(vL, 0, WORLD_SIZE - STAGE_SIZE), clamp(vT, 0, WORLD_SIZE - STAGE_SIZE), STAGE_SIZE, STAGE_SIZE, 0, 0, STAGE_SIZE, STAGE_SIZE);

    // 
    // 6 - Draw all shadows
    // 

    for (let i = 0; i < shadowList.length; i++) { // Draw all shadows
      drawActor(shadowList[i], 1); // Draw shadow
    }

    // 
    // 7 - Draw all visible actors
    // 

    renderList.sort((a, b) => (a.z > b.z) ? 1 : -1) // Sort render list into ascending z-order

    for (let i = 0; i < renderList.length; i++) { // Draw all actors
      drawActor(renderList[i]); // Draw actor
    }

  } // End pause check

  // 
  // Manage scene transitions
  // 

  if (transitioning) { // Is the application transitioning between scenes?
    
    if (transitionDirection) {
      if ((transitionAlpha -= DT * 2) <= 0) { // Is the vignette fully transparent?
        transitionAlpha = 0; // Set transparent
        transitionComplete(); // Call code
      }
    } else { // Transitioning out
      if ((transitionAlpha += DT * 2) >= 1) { // Is the vignette fully solid?
        transitionAlpha = 1; // Set solid
        transitionComplete(); // Call code
      }
    }
  } 

  // if (DEBUG) {
  //   debugLabel.label = `out:${OUT.length}`;
  // }
  
  requestAnimationFrame(onEnterFrame); // Request the next EnterFrame event
};
// #endregion

//   
// Create main display and background canvases
//   

CANVAS = newCanvas(STAGE_SIZE, STAGE_SIZE); // The game scene will be drawn here
CTX = CANVAS.ctx; // The drawing context for the main display

BACKGROUND_CANVAS = newCanvas(WORLD_SIZE, WORLD_SIZE); // The procedurally generated background will be drawn here
BACKGROUND_CTX = BACKGROUND_CANVAS.ctx;

// 
// Attach the main canvas to the HTML page and then rescale it
// 

D.body.appendChild(CANVAS); // Append the display to the HTML page
rescale(); // Perform initial display rescaling

// 
// Create the final texture atlas
// 

generateAssets();

// 
// Load scores from local storage. If they don't exist... create them
// 

SCORES = loadLocalFile('s'); // Load the scores from local storage
(!SCORES) ? resetHighScores() : SCORES = JSON.parse(SCORES);

// 
// Load options from local storage. If they don't exist... create them
// 

OPTIONS = loadLocalFile('o');
(!OPTIONS) ? resetOptions() : OPTIONS = JSON.parse(OPTIONS);

// 
// Create sound effects
// 

fx_add([.05,  1902,0,.16,0,4,1.15,8.9,0,0,0,0,0,0,.4,0,1,.12,0]); // FX_THRUST
fx_add([2,    345,.07,.04,.62,0,1.95,5.7,0,-75,0,.13,0,0,.1,.15,.59,.05,.23]); // FX_RESCUED
fx_add([2,    645,.08,.12,.91,2,1.74,2.2,0,0,.1,.12,0,0,.1,.08,.97,.01,.26]); // FX_WAVE_BEGIN
fx_add([1,    405,.05,.47,.56,2,.16,.1,0,-210,.03,.14,0,0,-0.3,0,.82,.08,0]); // FX_WAVE_END
fx_add([1,    688,.05,.06,.09,2,.91,-7.9,0,0,0,.08,0,0,0,.01,.79,.02,.3]); // FX_ENEMY_BULLET
fx_add([.5,   631,0,.04,.01,2,.32,-5.8,0,0,0,0,0,0,.1,.02,.72,.04,.4]); // FX_PLAYER_BULLET
fx_add([1,    549,.03,.05,.42,0,2.88,0,0,0,0,0,.5,2.8,.6,0,.85,.04,0]); // FX_EXPLOSION_1
fx_add([1,    286,.02,.06,.04,2,1.64,-4.9,.4,0,0,0,0,0,0,.08,.91,.04,0]); // FX_MINE
fx_add([1,    346,.05,.05,.08,3,.51,-8.5,0,0,0,.08,0,0,0,.09,.87,.04,.48]); // FX_BULLET_1
fx_add([1,    361,.02,.05,.09,4,1.98,-0.2,.9,0,0,0,0,0,.1,0,.76,.04,0]); // FX_BULLET_3
fx_add([1,    335,0,.13,.33,1,1.64,.1,0,0,0,0,.2,8.1,.3,0,.65,.04,.27]); // FX_EXPLOSION_2
fx_add([.5,   461,.01,.02,.07,4,.29,-2.4,-0.8,0,0,0,0,0,0,.04,.92,.03,0]); // FX_BULLET_2
fx_add([1,    92,.02,.03,.01,1,2.3,57,16,46,.04,.02,0,-2.9,0,0,.22,.04,0]); // FX_CLICK
fx_add([1,    146,.03,.34,.54,0,.86,0,-9.9,149,.03,.03,0,0,0,0,.65,.02,0]); // FX_SWARM_WARNING
fx_add([2,    114,.06,.49,.39,2,1.33,.9,7.2,-283,.06,.1,0,18,0,.11,.55,.09,0]); // FX_GAME_OVER
fx_add([1,  93,.05,.07,.08,3,1.57,-1.3,0,0,0,0,0,0,.1,.02,.74,.04,.5]); // FX_MISSILE
fx_add([1,    593,.06,.03,.91,2,1.27,0,0,27,.06,0,0,47,.1,0,.64,.07,.26]); // FX_AGGRESSOR_ALERT
fx_add([1,    353,0,0,.32,2,2.32,-0.2,-1.5,0,0,0,.5,-6.9,.1,0,.8,.08,.04]); // FX_ERROR
fx_add([1.7,  428,0,0,.24,4,1.11,8.7,-1.6,0,0,0,.6,0,.2,.02,.65,.09,.07]); // FX_HIT

// 
// Generate a  bunch of random x and y coordinate pairs to represent stars (no z required, it is derived later)
// 

for (let t = 0; t < 144; t++) { // Generate this many stars (must be evenly divisible by the number of layers)
  STARS.push([random() * STAGE_SIZE, random() * STAGE_SIZE]); // Push random coordinates
}

// 
// Create the player
// 

PLAYER = newActor();
PLAYER.r = ROLE_PLAYER;
PLAYER.cR = 6;
PLAYER.z = 5;
PLAYER.cS = 1;
PLAYER.v= 0;
setTextureRegion(PLAYER, getTextureRegion(TR_PLAYER));

TARGET = PLAYER; // Set the camera target

// 
// Install window resizing handler
// 

W.onresize = () => {
  rescale(); // erform content rescaling
}

// 
// Install input handlers
// 

// D.addEventListener('keydown', keyDown);
// D.addEventListener('keyup', keyUp);
// D.addEventListener('mousedown', ui_mouseDown);
// D.addEventListener('mouseup', ui_mouseUp);

D.onkeyup = keyUp;
D.onkeydown = keyDown;
D.onmousedown = ui_mouseDown;
D.onmouseup = ui_mouseUp;
D.onmousemove = () => {showCursor(1)};

// 
// Reset the pool, which basically recreates it
// 

resetPool();

// 
// Begin transition so the main menu can be seen
// 

mainMenu();

// 
// Game on!
// 

lastFrame = Date.now(); // Set the (fake) last EnterFrame event time
onEnterFrame(); // Request the first actual EnterFrame event
