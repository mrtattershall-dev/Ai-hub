class Enemigo{
    constructor(area){

        this.spawn = {x: area.x, y: area.y};
        this.nivel = area.nivel;
        this.position = {x: area.x, y: area.y};
        this.size = { x: 6, y: 10};
        this.angle = area.angleInicial;
        this.angleInicial = area.angleInicial;
        this.patrulla = 1;
        this.angleToPlayer = 0;
        this.canMove = true;
        this.colision = [];
        this.speed = 0;
        this.maxSpeed = 0.25;
        this.acceleration = 0.1;
        this.showCanon = false;
        this.recarga = 8;
        this.recargaTimer = 0;
        this.canShoot = true;
        this.vida = 25 * area.nivel;
    }

    Update(deltaTime){
        
        this.crearCajaColision();

        this.canMove = true;

        if(!this.canShoot){
            if(this.recargaTimer > 0){
                this.recargaTimer = this.recargaTimer - deltaTime;
            }
            else{
                this.canShoot = true;
                this.recargaTimer = 0;
            }
        }

        for (let i = 0; i < world.continentes.length; i++) {
            if(ComprobarColisionPoligono(this.colision, world.continentes[i])){
                if(this.canMove){
                    this.canMove = false;
                } 
            }
        }

        if(this.patrulla){
            this.speed = 0;
            if(this.angle > this.angleInicial + Math.PI/4){
                this.patrulla = -1;
            }
            if(this.angle < this.angleInicial - Math.PI/4){
                this.patrulla = 1;
            }
            this.angle = this.angle + 0.01 * this.patrulla;
        }
        else{
            if(this.canMove){
                this.angleToPlayer = this.angle + 90 * Math.PI / 180 + Math.atan2( player.position.y - this.position.y, player.position.x - this.position.x ); 

                if(this.angleToPlayer != 0){
                    if(Math.sin(this.angleToPlayer) > 0){
                        this.angle = this.angle - 0.01
                    }
                    else{
                        this.angle = this.angle + 0.01
                    }
                }
                if(this.speed < this.maxSpeed){
                    this.speed+=this.acceleration;
                }
                if(this.speed>this.maxSpeed){
                    this.speed=this.maxSpeed;
                }

            }
            else{
                this.angle = this.angle - 0.01
                this.speed = 0;
            }

            if(Math.sqrt(SqrDistance(player.position, this.position)) < 20){
                this.showCanon = true;
                if(this.canShoot){
                    this.Disparar();
                }
            }
            else{
                this.showCanon = false;
            }
        }

        this.position.x-=Math.sin(this.angle)*this.speed;
        this.position.y-=Math.cos(this.angle)*this.speed;

        if(Math.sqrt(SqrDistance(player.position, this.position)) < 100){
            this.patrulla = null;
        }
        else{
            if(!this.patrulla){
                this.patrulla = -1;
            } 
            if(player.vida < player.maxVida)
            player.vida = player.vida + 0.25;
        }
    }

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
    }
    
    Disparar(){
        if(this.canShoot){
            player.vida = player.vida - 5 * this.nivel;
        }
        this.canShoot = false;
        this.recargaTimer = this.recarga;
    }
}