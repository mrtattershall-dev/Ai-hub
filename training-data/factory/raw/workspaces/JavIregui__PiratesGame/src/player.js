var player = {

    position: {
        x: 0,
        y: 0
    },
    size: {
        x: 0,
        y: 0
    },
    sizes: {
        lejano: {
            x: 16,
            y: 22
        },
        medio: {
            x: 10,
            y: 16
        },
        combate: {
            x: 6,
            y: 10
        }
    },
    velocidades: {
        lejano: 0.75,
        medio: 0.5,
        combate: 0.25,
    },
    canMove: true,
    speed: 0,
    acceleration: 0.1,
    maxSpeed: 0,
    friction: 0.05,
    angle: 0,
    colision: [],
    move: false,

    numColumns: 4,
    numRows: 6,
    frameWidth: null,
    frameHeight: null,
    currentFrame: 0,
    maxFrame: null,
    animSpeed: 3,

    column: this.currentFrame % this.numColumns,
    row: Math.floor(this.currentFrame / this.numColumns),

    shotRange: null,
    canShoot: null,
    recargaTimer: null,
    recarga: null,

    nivel: null,
    vida: null,
    maxVida: null,

    Start()
    {
        this.maxVida = 50;
        this.vida = this.maxVida;
        this.nivel = 1;
        this.recarga = 4;
        this.recargaTimer = 0;
        this.canShoot = true;
        this.shotRange = 0;
        this.frameWidth = graphicAssets.animation.image.width / this.numColumns;
        this.frameHeight = graphicAssets.animation.image.height / this.numRows;
        this.position.x = -150;
        this.position.y = 0;
        this.maxFrame = this.numColumns * this.numRows - 1;
    },

    Update(deltaTime)
    {  
        this.maxVida = 50 * this.nivel;

        if(this.vida <= 0 || world.enemigosRestantes == 0){
            currentGameState = GAME_STATE.end;
        }

        switch (world.enemigosRestantes) {
            case 25:
                this.nivel=2;
            break;
            case 20:
                this.nivel=3;
            break;
            case 15:
                this.nivel=4;
            break;
            case 10:
                this.nivel=5;
            break;
            case 5:
                this.nivel=6;
            break;
        }

        if(this.animSpeed == 0){
            this.currentFrame++;
            this.animSpeed = 3;
        }
        else{
            this.animSpeed--;
        }
        

        if (this.currentFrame > this.maxFrame){
            this.currentFrame = 0;
        }

        this.column = this.currentFrame % this.numColumns;
        this.row = Math.floor(this.currentFrame / this.numColumns);

        switch (world.camara) {
            case world.zoom.lejano:
                this.size = this.sizes.lejano;
                this.maxSpeed = this.velocidades.lejano;
            break;
            case world.zoom.medio:
                this.size = this.sizes.medio;
                this.maxSpeed = this.velocidades.medio;
            break;
            case world.zoom.combate:
                this.size = this.sizes.combate;
                this.maxSpeed = this.velocidades.combate;
            break;
        }

        this.crearCajaColision();
        this.canMove = true;
        for (let i = 0; i < world.continentes.length; i++) {
            if(ComprobarColisionPoligono(this.colision, world.continentes[i])){
                if(this.canMove){
                    this.canMove = false;
                } 
            }
        }

        if(Input.IsKeyUp(KEY_W)){
            this.move = true;
        }
        if(Input.IsKeyUp(KEY_S)){
            this.move = false;
        }

        if(this.move){
            if(this.speed < this.maxSpeed){
                this.speed+=this.acceleration;
            }
        }
        else{
            if(this.speed >= 0){
                this.speed-=this.acceleration;
            }
        }

        if(this.speed>this.maxSpeed){
            this.speed=this.maxSpeed;
        }
        if(this.speed <= 0){
            this.speed = 0;
        }

        if(this.speed>0){
            this.speed-=this.friction;
        }
        if(this.speed<0){
            this.speed+=this.friction;
        }
        if(Math.abs(this.speed)<this.friction){
            this.speed=0;
        }

        if(Input.IsKeyPressed(KEY_A)){
            this.angle+=0.015;
        }
        if(Input.IsKeyPressed(KEY_D)){
            this.angle-=0.015;
        }

        if(!this.canMove){
            this.speed = 0;
        }

        if(this.position.x > canvas.width / 2){
            this.position.x = canvas.width / 2;
        }
        if(this.position.x < -canvas.width / 2){
            this.position.x = -canvas.width / 2;
        }
        if(this.position.y > canvas.height / 2){
            this.position.y = canvas.height / 2;
        }
        if(this.position.y < -canvas.height / 2){
            this.position.y = -canvas.height / 2;
        }

        this.position.x-=Math.sin(this.angle)*this.speed;
        this.position.y-=Math.cos(this.angle)*this.speed;

        if(!this.canShoot){
            if(this.recargaTimer > 0){
                this.recargaTimer = this.recargaTimer - deltaTime;
            }
            else{
                this.canShoot = true;
                this.recargaTimer = 0;
            }
        }

        if(world.camara != world.zoom.combate){
            this.shotRange = 0;
        }

        if(Input.IsKeyUp(KEY_RIGHT) && world.camara == world.zoom.combate){
            if(this.shotRange < 1){
                this.shotRange++;
            }
        }
        if(Input.IsKeyUp(KEY_LEFT)){
            if(this.shotRange > 0){
                this.shotRange--;
            }
        }

        if(Input.IsKeyUp(KEY_SPACE) && this.shotRange > 0){
            this.Disparar();
        }
    },

    Draw(ctx)
    {   
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(world.camara, world.camara);
        ctx.rotate(-this.angle);

        if(this.speed > 0){
            ctx.drawImage(graphicAssets.animation.image, this.column * this.frameWidth, this.row * this.frameHeight, this.frameWidth, this.frameHeight, -(this.size.x * 1.5)/2, (this.size.y * 1.5)/2*0.1, this.size.x * 1.5, this.size.y * 1.5);
        }
        
        if(this.shotRange == 1 && world.camara == world.zoom.combate){
            if(this.canShoot){
                ctx.fillStyle = "rgba(0,0,0,0.35)";
                ctx.beginPath();
                ctx.arc(0, 0, 20, 0, 2 * Math.PI);
                ctx.fill();
            }
            else{
                ctx.fillStyle = "rgba(255,0,0,0.35)";
                ctx.beginPath();
                ctx.arc(0, 0, 20, 0, 2 * Math.PI);
                ctx.fill();
            }
            
        }

        ctx.drawImage(graphicAssets.barco.image, -(this.size.x * 1.5)/2, -(this.size.y * 1.5)/2 , this.size.x * 1.5, this.size.y * 1.5);
        
        ctx.restore();

        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.textAlign = "start";
        ctx.fillText("HP: " + this.vida,canvas.width-300, 55);
        ctx.fillText("XP: " + this.nivel,canvas.width-300, 75);
        ctx.font = "20px Arial";
        ctx.fillText("ENEMY HP: " + world.enemigos[0].vida, canvas.width-300, 95);
        ctx.fillText("REMAINING ENEMIES: " + world.enemigosRestantes, canvas.width-300, 115);
    },

    crearCajaColision(){
        this.colision=[];

        const rad=Math.hypot(this.size.x,this.size.y)/2;
        const alpha=Math.atan2(this.size.x,this.size.y);

        this.colision.push({
            x: this.position.x - Math.sin(this.angle-alpha)*rad,
            y: this.position.y - Math.cos(this.angle-alpha)*rad
        });

        this.colision.push({
            x:this.position.x-Math.sin(this.angle+alpha)*rad,
            y:this.position.y-Math.cos(this.angle+alpha)*rad
        });

        this.colision.push({
            x:this.position.x-Math.sin(Math.PI+this.angle-alpha)*rad,
            y:this.position.y-Math.cos(Math.PI+this.angle-alpha)*rad
        });
        
        this.colision.push({
            x:this.position.x-Math.sin(Math.PI+this.angle+alpha)*rad,
            y:this.position.y-Math.cos(Math.PI+this.angle+alpha)*rad
        });
    },
    Disparar(){
        if(this.canShoot){
            if(Math.sqrt(SqrDistance(this.position, world.enemigos[0].position)) < 20){
                world.enemigos[0].vida =world.enemigos[0].vida - 5 * this.nivel;
            }
        }
        this.canShoot = false;
        this.recargaTimer = this.recarga;
    }
}