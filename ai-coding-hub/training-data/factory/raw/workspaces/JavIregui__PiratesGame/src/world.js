var world = {
    continentes:[
        cuba = [{x: -287, y: -20}, {x: -312, y: -18} , {x: -335, y: -31}, {x: -346, y: -34}, {x: -334, y: -40}],
        
        islandia = [{x: -108, y: -188}, {x: -117, y: -200}, {x: -89, y: -197}],
        
        filipinas = [{x: 344, y: -21}, {x: 352, y: -18} , {x: 370, y: 16}, {x: 370, y: 31}, {x: 363, y: 30}, {x: 340, y: -9}],
        
        isla1 = [{x: 481, y: 85}, {x: 486, y: 84} , {x: 488, y: 90}, {x: 483, y: 91}],
        
        isla2 = [{x: 489, y: 113}, {x: 492, y: 119} , {x: 483, y: 128}, {x: 478, y: 122}],
        
        madagascar = [{x: 104, y: 98}, {x: 109, y: 105} , {x: 91, y: 151}, {x: 82, y: 144}, {x: 85, y: 119}],
        
        nuevaGuinea = [{x: 388, y: 52}, {x: 445, y: 70} , {x: 457, y: 67}, {x: 462, y: 60}, {x: 445, y: 82}, {x: 453, y: 92}
            , {x: 449, y: 96}, {x: 430, y: 83}, {x: 424, y: 87}, {x: 407, y: 83}, {x: 407, y: 75}, {x: 390, y: 68}, {x: 383, y: 57}],
        
        nuevaZelanda = [{x: 480, y: 182}, {x: 492, y: 199} , {x: 439, y: 233}, {x: 428, y: 228}, {x: 477, y: 198}],
        
        australia = [{x: 410, y: 116}, {x: 420, y: 94} , {x: 427, y: 94}, {x: 448, y: 158}, {x: 405, y: 213}, {x: 391, y: 220}
            , {x: 392, y: 200}, {x: 370, y: 174}, {x: 314, y: 184}, {x: 320, y: 135}, {x: 344, y: 128}, {x: 355, y: 112}, {x: 395, y: 95}],
        
        america = [{x: -76, y: -247}, {x: -115, y: -208} , {x: -163, y: -194}, {x: -172, y: -181}, {x: -189, y: -184}
            , {x: -188, y: -229}, {x: -217, y: -236}, {x: -234, y: -227}, {x: -214, y: -202}, {x: -231, y: -179}
            , {x: -219, y: -133}, {x: -242, y: -133}, {x: -257, y: -121}, {x: -278, y: -118}, {x: -328, y: -66}
            , {x: -330, y: -48}, {x: -335, y: -48}, {x: -341, y: -65}, {x: -383, y: -57}, {x: -389, y: -38}, {x: -382, y: -22}
            , {x: -371, y: -22}, {x: -365, y: -31}, {x: -354, y: -31}, {x: -362, y: -12}, {x: -346, y: -9}, {x: -340, y: 14}
            , {x: -325, y: 15}, {x: -304, y: 4}, {x: -276, y: 10}, {x: -180, y: 70}, {x: -180, y: 90}, {x: -207, y: 142}
            , {x: -223, y: 149}, {x: -223, y: 162}, {x: -240, y: 192}, {x: -259, y: 218}, {x: -219, y: 249}, {x: -244, y: 263}
            , {x: -252, y: 267}, {x: -274, y: 255}, {x: -300, y: 197}, {x: -300, y: 121}, {x: -322, y: 109}, {x: -340, y: 71}
            , {x: -334, y: 42}, {x: -327, y: 36}, {x: -329, y: 25}, {x: -355, y: 14}, {x: -357, y: 2}, {x: -416, y: -23}
            , {x: -441, y: -54}, {x: -452, y: -83}, {x: -453, y: -103}, {x: -431, y: -144}, {x: -435, y: -172}, {x: -461, y: -180}
            , {x: -508, y: -164}, {x: -505, y: -185}, {x: -468, y: -209}, {x: -426, y: -216}, {x: -370, y: -214}, {x: -318, y: -235}
            , {x: -185, y: -250}, {x: -76, y: -247}],
        
        eurAfrAs = [{x: -88, y: -117}, {x: -71, y: -117} , {x: -63, y: -124}, {x: -76, y: -140}, {x: -89, y: -142}, {x: -91, y: -155}
            , {x: -79, y: -161}, {x: -70, y: -175}, {x: -52, y: -148}, {x: -36, y: -159}, {x: -45, y: -182}, {x: 5, y: -221}
            , {x: 50, y: -208}, {x: 178, y: -237}, {x: 259, y: -221}, {x: 370, y: -213}, {x: 433, y: -201}, {x: 433, y: -192}
            , {x: 397, y: -176}, {x: 405, y: -161}, {x: 402, y: -145}, {x: 379, y: -163}, {x: 385, y: -176}, {x: 339, y: -174}
            , {x: 333, y: -163}, {x: 359, y: -158}, {x: 378, y: -126}, {x: 392, y: -119}, {x: 387, y: -109}, {x: 393, y: -87}
            , {x: 366, y: -69}, {x: 361, y: -76}, {x: 365, y: -85}, {x: 375, y: -88}, {x: 379, y: -102}, {x: 363, y: -135}
            , {x: 356, y: -114}, {x: 346, y: -107}, {x: 355, y: -86}, {x: 347, y: -80}, {x: 338, y: -96}, {x: 328, y: -90}
            , {x: 343, y: -57}, {x: 348, y: -33}, {x: 338, y: -33}, {x: 334, y: -42}, {x: 312, y: -33}, {x: 310, y: -3}
            , {x: 297, y: 18}, {x: 289, y: 19}, {x: 297, y: 44}, {x: 307, y: 46}, {x: 336, y: 24}, {x: 347, y: 30}
            , {x: 343, y: 44}, {x: 379, y: 45}, {x: 379, y: 52}, {x: 363, y: 52}, {x: 363, y: 59}, {x: 375, y: 61}
            , {x: 378, y: 69}, {x: 361, y: 67}, {x: 357, y: 74}, {x: 372, y: 85}, {x: 360, y: 92}, {x: 348, y: 93}
            , {x: 298, y: 80}, {x: 263, y: 32}, {x: 273, y: 12}, {x: 245, y: -36}, {x: 212, y: -13}, {x: 211, y: 11}
            , {x: 220, y: 19}, {x: 216, y: 32}, {x: 211, y: 32}, {x: 207, y: 23}, {x: 198, y: 18}, {x: 182, y: -28}
            , {x: 161, y: -46}, {x: 138, y: -45}, {x: 138, y: -32}, {x: 114, y: -7}, {x: 90, y: 7}, {x: 110, y: 7}
            , {x: 102, y: 33}, {x: 73, y: 65}, {x: 76, y: 112}, {x: 59, y: 124}, {x: 57, y: 137}, {x: 31, y: 181}
            , {x: 1, y: 187}, {x: -24, y: 127}, {x: -16, y: 99}, {x: -22, y: 72}, {x: -35, y: 55}, {x: -30, y: 40}
            , {x: -45, y: 28}, {x: -90, y: 34}, {x: -117, y: 9}, {x: -121, y: -27}, {x: -94, y: -77}, {x: -78, y: 89}, {x: -89, y: -93}, {x: -88, y: -117}],
    ],
    areas:[
        americaN = {
            index: 0,
            x: -275,
            y: -75,
            nivel: 3,
            angleInicial: -Math.PI/2
        },
        americaS = {
            index: 1,
            x: -200,
            y: 175,
            nivel: 6,
            angleInicial: -Math.PI/4
        },
        africa = {
            index: 2,
            x: -75,
            y: 100,
            nivel: 2,
            angleInicial: Math.PI/4
        },
        europa = {
            index: 3,
            x: -125,
            y: -125,
            nivel: 1,
            angleInicial: Math.PI/2
        },
        asia = {
            index: 4,
            x: 150,
            y: 0,
            nivel: 5,
            angleInicial: Math.PI
        },
        oceania = {
            index: 5,
            x: 275,
            y: 200,
            nivel: 4,
            angleInicial: Math.PI/2
        }
    ],
    zoom:{
        lejano: 1,
        medio: 2,
        combate: 8
    },
    camara: 1,
    enemigos: [],
    enemigosRestantes: null,
    
    Start()
    {
        this.enemigosRestantes = 5 * 6;
        this.enemigos = [];
        this.camara = this.zoom.medio;
    },

    Update(deltaTime)
    {   
        for (let i = 0; i < this.enemigos.length; i++) {
            this.enemigos[i].Update(deltaTime);
            if(this.enemigos[i].vida <= 0){
                this.enemigos.splice(i);
                --this.enemigosRestantes;
            }
        }

        for( var i = 0; i < this.areas.length; i++){ 
    
            if(this.enemigos.length < 1){
                if(this.areas[i].nivel == player.nivel){
                    this.enemigos.push(new Enemigo(this.areas[i]));
                }
                
            }
        
        }

        if(Input.IsKeyUp(KEY_UP)){
            switch (this.camara) {
                case this.zoom.lejano:
                    this.camara = this.zoom.medio;
                    player.shotRange = 0;
                    break;
                case this.zoom.medio:
                    this.camara = this.zoom.combate;
                    player.shotRange = 0;
                    break;
            }
        }
    
        if(Input.IsKeyUp(KEY_DOWN)){
            switch (this.camara) {
                case this.zoom.combate:
                    this.camara = this.zoom.medio;
                    player.shotRange = 0;
                    break;
                case this.zoom.medio:
                    this.camara = this.zoom.lejano;
                    player.shotRange = 0;
                    break;
            }
        }
    },

    Draw(ctx)
    {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(this.camara, this.camara);

        ctx.drawImage(graphicAssets.mar.image, -player.position.x - canvas.width / 2, -player.position.y - canvas.height / 2, canvas.width, canvas.height);
        ctx.drawImage(graphicAssets.continentes.image, -player.position.x - canvas.width / 2, -player.position.y - canvas.height / 2, canvas.width, canvas.height);    
        ctx.drawImage(graphicAssets.letras.image, -player.position.x - canvas.width / 2, -player.position.y - canvas.height / 2, canvas.width, canvas.height);

        for (let i = 0; i < this.enemigos.length; i++) {

            ctx.translate(this.enemigos[i].position.x - player.position.x , this.enemigos[i].position.y - player.position.y);
            ctx.rotate(-this.enemigos[i].angle);
            if(this.enemigos[i].showCanon && this.camara == this.zoom.combate){
                ctx.fillStyle = "rgba(255,0,0,0.35)";
                ctx.beginPath();
                ctx.arc(0, 0, 20, 0, 2 * Math.PI);
                ctx.fill();  
            }
            
            ctx.drawImage(graphicAssets.enemigo.image, -this.enemigos[i].size.x, -this.enemigos[i].size.y , this.enemigos[i].size.x * 2, this.enemigos[i].size.y * 2);

            ctx.rotate(this.enemigos[i].angle);
        }
        
        ctx.restore();
    },
}