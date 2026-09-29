var canvas;
var ctx;

var targetDeltaTime = 1 / 60;
var currentDeltaTime = 0;
var time = 0,
    FPS = 0,
    frames = 0,
    acumDelta = 0;
var timeSinceBegining = 0;
var timePlayed = 0;

const GAME_STATE = {
    menu: 0,
    game: 1,
    end: 2
}

var currentGameState = GAME_STATE.menu;

var graphicAssets = {
    logo: {
        path: "assets/logo.png",
        image: null
    },
    manual: {
        path: "assets/manual.png",
        image: null
    },
    animation: {
        path: "assets/agua.png",
        image: null
    },
    barco: {
        path: "assets/barco.png",
        image: null
    },
    enemigo: {
        path: "assets/barcoEnemigo.png",
        image: null
    },
    mar: {
        path: "assets/mar.png",
        image: null
    },
    continentes: {
        path: "assets/continentes.png",
        image: null
    },
    letras: {
        path: "assets/letras.png",
        image: null
    }
};


function LoadImages(assets, onloaded)
{
    let imagesToLoad = 0;
    
    const onload = () => --imagesToLoad === 0 && onloaded();

    for (let asset in assets)
    {
        if (assets.hasOwnProperty(asset))
        {
            imagesToLoad++;

            const img = assets[asset].image = new Image;
            img.src = assets[asset].path;
            img.onload = onload;
        }
     }
    return assets;
}

window.requestAnimationFrame = (function (evt){
    return window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback){
            window.setTimeout(callback, targetDeltaTime * 1000)
        };

}) ();

window.onload = BodyLoaded;

function BodyLoaded(){

    canvas = document.getElementById("myCanvas");
    ctx = canvas.getContext("2d");

    SetupKeyboardEvents();
    SetupMouseEvents();

    LoadImages(graphicAssets, function() {

        currentGameState = GAME_STATE.menu;
        Start();
        Loop();

    });
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Start(){
    time = Date.now();
    timeSinceBegining = 0;
    timePlayed = 0;
    switch (currentGameState) {
        case GAME_STATE.menu:
            menu.Start();
        break;
        case GAME_STATE.game:
            world.Start();
            player.Start();
        break;
        case GAME_STATE.end:
            end.Start();
        break;
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Loop(){

    requestAnimationFrame(Loop);

    const now = Date.now();
    let deltaTime = (now - time) / 1000;
    currentDeltaTime = deltaTime;

    time = now;

    frames++;
    acumDelta += deltaTime;

    if (acumDelta > 1)
    {
        FPS = frames;
        frames = 0;
        acumDelta-= 1;
    }

    if (deltaTime > 0.1){
        deltaTime = 0.1;
    }
        
    Update(deltaTime);

    Draw(ctx);

    Input.PostUpdate();
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Update(deltaTime)
{
    switch (currentGameState) {
        case GAME_STATE.menu:
            menu.Update(deltaTime);
        break;
        case GAME_STATE.game:
            world.Update(deltaTime);
            player.Update(deltaTime);
        break;
        case GAME_STATE.end:
            end.Update(deltaTime);
        break;
    }
}

function Draw(ctx)
{
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    switch (currentGameState) {
        case GAME_STATE.menu:
            menu.Draw(ctx);
        break;
        case GAME_STATE.game:
            world.Draw(ctx);
            player.Draw(ctx);
        break;
        case GAME_STATE.end:
            end.Draw(ctx);
        break;
    }


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ctx.fillStyle = "white";
    ctx.font = "12px Comic Sans MS regular";
    ctx.textAlign = "start";
    ctx.fillText("Time=" + timePlayed, 10, canvas.height-55);
    ctx.fillText("FPS=" + FPS, 10, canvas.height-40);
    ctx.fillText("deltaTime=" + currentDeltaTime, 10, canvas.height-25);
    ctx.fillText("currentFPS=" + (1/currentDeltaTime).toFixed(2), 10, canvas.height-10);
}