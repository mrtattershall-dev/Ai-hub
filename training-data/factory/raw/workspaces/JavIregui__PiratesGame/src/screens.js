var menu = {
 
    botonPlay: false,
    botonInstrucciones: false,

    Start()
    {
        
    },

    Update(deltaTime)
    {
        if(Input.mouse.x > canvas.width / 2 - 150 && Input.mouse.x < canvas.width / 2 + 150 && Input.mouse.y > canvas.height - 325 && Input.mouse.y < canvas.height - 255){
            this.botonPlay = true;
        }
        else{
            this.botonPlay = false;
        }

        if(Input.mouse.x > canvas.width / 2 - 150 && Input.mouse.x < canvas.width / 2 + 150 && Input.mouse.y > canvas.height - 215 && Input.mouse.y < canvas.height - 165){
            this.botonInstrucciones = true;
        }
        else{
            this.botonInstrucciones = false;
        }


        if(this.botonPlay && Input.mouse.down){
            currentGameState = GAME_STATE.game;
            Start();
        }
    },

    Draw(ctx)
    {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(graphicAssets.logo.image, canvas.width / 2 - canvas.width/4, 100, canvas.width/2, canvas.height/4);

        ctx.fillStyle = "#dbb80b";
        ctx.textAlign = "center";
        if(this.botonPlay){
            ctx.font = "45px Arial";
        }
        else{
            ctx.font = "40px Arial";
        }

        ctx.fillText("PLAY", canvas.width / 2, canvas.height - 275);  

        if(this.botonInstrucciones){
            ctx.font = "45px Arial";
        }
        else{
            ctx.font = "40px Arial";
        }
        ctx.fillText("INSTRUCTIONS", canvas.width / 2, canvas.height - 200);

        if(this.botonInstrucciones){
            ctx.drawImage(graphicAssets.manual.image, 0, 0, canvas.width, canvas.height);
        }
    }
}

var end = {

    botonMenu: null,

    Start()
    {
        this.botonMenu = false;
    },

    Update(deltaTime)
    {
        if(Input.mouse.x > canvas.width / 2 - 250 && Input.mouse.x < canvas.width / 2 + 250 && Input.mouse.y > canvas.height - 225 && Input.mouse.y < canvas.height - 155){
            this.botonMenu = true;
        }
        else{
            this.botonMenu = false;
        }

        if(this.botonMenu && Input.mouse.down){
            currentGameState = GAME_STATE.menu;
            Start();
        }
    },

    Draw(ctx)
    {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(graphicAssets.logo.image, canvas.width / 2 - canvas.width/4, 150, canvas.width/2, canvas.height/4);

        ctx.fillStyle = "#dbb80b";
        ctx.textAlign = "center";
        ctx.font = "40px Arial";
        if(player.vida == 0){
            ctx.fillText("YOU LOOSE", canvas.width / 2, canvas.height - 275);
        }
        else{
            ctx.fillText("YOU WIN", canvas.width / 2, canvas.height - 275);
        }
        if(this.botonMenu){
            ctx.font = "45px Arial";
        }
        else{
            ctx.font = "40px Arial";
        }

           
        ctx.fillText("BACK", canvas.width / 2, canvas.height - 200);       
    }
}