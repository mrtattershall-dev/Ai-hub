function _drawHair(ctx,hx,hy,hw,hh,hs,isFem,HAIR,B,dir){
  const p=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
  const D=HAIR[0],M=HAIR[1],L=HAIR[2];

  if(!isFem){
    // 0: Short crop — snug cap with slight fringe
    if(hs===0){
      if(dir==='down'||dir==='up'){
        p(hx+1,hy-1,hw-2,1,B); p(hx,hy,hw,1,B);    // top outline
        p(hx+1,hy-1,hw-2,1,M); // top of hair
        p(hx,hy,   1,5,B); p(hx+1,hy,1,4,D);        // left sideburn
        p(hx+hw-1,hy,1,5,B); p(hx+hw-2,hy,1,4,D);  // right sideburn
        if(dir==='down') p(hx+2,hy,4,1,M); // fringe stripe
        if(dir==='up'){  // back of head — full cap coverage
          p(hx,hy,hw,hh-1,B); p(hx+1,hy,hw-2,hh-2,D); p(hx+2,hy,hw-4,hh-3,M);
        }
      } else {
        p(hx,hy-1,hw+1,2,B); p(hx+1,hy-1,hw-1,1,M);
        if(dir==='right'){ p(hx,hy,1,4,B); p(hx+1,hy,1,3,D); }
        else             { p(hx+hw,hy,1,4,B); p(hx+hw-1,hy,1,3,D); }
      }
    }
    // 1: Side part
    else if(hs===1){
      if(dir==='down'||dir==='up'){
        p(hx,hy-2,hw,3,B); p(hx+1,hy-2,hw-2,2,M); p(hx+1,hy-2,5,1,L);
        p(hx,hy,  1,6,B); p(hx+1,hy,1,5,D);
        p(hx+hw-1,hy,1,6,B); p(hx+hw-2,hy,1,5,D);
        if(dir==='down') p(hx,hy,4,2,D),p(hx+4,hy-1,4,2,M);
        if(dir==='up'){  // back — swept hair covering full head
          p(hx,hy,hw,hh-1,B); p(hx+1,hy,hw-2,hh-2,D); p(hx+2,hy,hw-4,hh-3,M);
          p(hx+1,hy,hw-4,2,L); // swept highlight at top-back
        }
      } else {
        p(hx,hy-2,hw+1,3,B); p(hx+1,hy-2,hw,2,M); p(hx+1,hy-2,6,1,L);
        if(dir==='right'){ p(hx,hy,1,6,B); p(hx+1,hy,1,5,D); }
        else             { p(hx+hw,hy,1,6,B); p(hx+hw-1,hy,1,5,D); }
      }
    }
    // 2: Wavy / tousled
    else if(hs===2){
      if(dir==='down'||dir==='up'){
        p(hx,hy-2,hw,4,B); p(hx+1,hy-2,hw-2,3,M);
        p(hx-1,hy,2,7,B); p(hx,hy+1,1,6,M);
        p(hx+hw-1,hy,2,7,B); p(hx+hw-1,hy+1,1,6,M);
        // wave bumps
        p(hx+1,hy-3,2,2,B); p(hx+2,hy-3,1,1,L);
        p(hx+4,hy-4,3,3,B); p(hx+5,hy-4,2,2,L);
        p(hx+7,hy-3,2,2,B); p(hx+8,hy-3,1,1,M);
        if(dir==='up'){  // back — wavy mass covers head + slight volume below
          p(hx,hy,hw,hh,B); p(hx+1,hy,hw-2,hh-1,D); p(hx+2,hy,hw-4,hh-2,M);
          p(hx-1,hy+hh-2,2,5,B); p(hx,hy+hh-2,1,4,D); // left wave tail
          p(hx+hw-1,hy+hh-2,2,5,B); p(hx+hw-1,hy+hh-2,1,4,D); // right wave tail
        }
      } else {
        p(hx,hy-2,hw+1,4,B); p(hx+1,hy-2,hw,3,M);
        p(hx,hy-4,3,3,B); p(hx+1,hy-4,2,2,L); // front bump
        if(dir==='right'){ p(hx,hy,1,7,B); p(hx+1,hy+1,1,6,M); }
        else             { p(hx+hw,hy,1,7,B); p(hx+hw-1,hy+1,1,6,M); }
      }
    }
    // 3: Slicked back
    else if(hs===3){
      if(dir==='down'||dir==='up'){
        p(hx,hy-1,hw,2,B); p(hx+1,hy-1,hw-2,1,D); p(hx+2,hy-1,hw-6,1,M);
        p(hx,hy,1,4,B); p(hx+1,hy,1,3,D);
        p(hx+hw-1,hy,1,4,B); p(hx+hw-2,hy,1,3,D);
        if(dir==='up'){  // back — slicked flat across whole head
          p(hx,hy,hw,hh-1,B); p(hx+1,hy,hw-2,hh-2,D);
          p(hx+2,hy,hw-4,2,M); // sheen line across back
        }
      } else {
        p(hx,hy-1,hw+1,2,B); p(hx+1,hy-1,hw,1,D); p(hx+2,hy-1,4,1,M);
        if(dir==='right'){ p(hx+hw-1,hy,2,4,B); p(hx+hw-1,hy,1,3,D); }
        else             { p(hx,hy,2,4,B); p(hx+1,hy,1,3,D); }
      }
    }
    // 4: Shaggy / messy
    else if(hs===4){
      if(dir==='down'||dir==='up'){
        p(hx,hy-3,hw,5,B); p(hx+1,hy-3,hw-2,4,M);
        p(hx-1,hy,2,8,B); p(hx,hy+1,1,7,M);
        p(hx+hw-1,hy,2,8,B); p(hx+hw-1,hy+1,1,7,M);
        p(hx+1,hy-4,3,2,B); p(hx+2,hy-4,2,1,L);
        p(hx+5,hy-5,3,3,B); p(hx+6,hy-5,2,2,L);
        p(hx+8,hy-4,2,2,B); p(hx+9,hy-4,1,1,M);
        if(dir==='down'){ p(hx,hy,3,2,D); p(hx+hw-3,hy,3,2,D); }
        if(dir==='up'){  // back — shaggy chunks, longer and messier
          p(hx,hy,hw,hh,B); p(hx+1,hy,hw-2,hh-1,D); p(hx+2,hy,hw-4,hh-2,M);
          p(hx-1,hy+hh-3,3,7,B); p(hx,hy+hh-2,2,6,D); // left shaggy tail
          p(hx+hw-2,hy+hh-3,3,7,B); p(hx+hw-2,hy+hh-2,2,6,D); // right shaggy tail
          p(hx+3,hy+hh-1,4,5,B); p(hx+4,hy+hh,3,4,D); // centre chunk
        }
      } else {
        p(hx,hy-3,hw+1,5,B); p(hx+1,hy-3,hw,4,M);
        p(hx,hy-5,3,3,B); p(hx+1,hy-5,2,2,L);
        if(dir==='right'){ p(hx,hy,1,8,B); p(hx+1,hy+1,1,7,M); }
        else             { p(hx+hw,hy,1,8,B); p(hx+hw-1,hy+1,1,7,M); }
      }
    }
    // 5: Bald — just a slight scalp shadow
    else{
      ctx.globalAlpha=0.12;
      p(hx+1,hy,hw-2,2,'#ffffff');
      ctx.globalAlpha=1;
    }

  } else {
    // FEMALE
    // 0: Ponytail
    if(hs===0){
      if(dir==='down'||dir==='up'){
        p(hx,hy-2,hw,4,B); p(hx+1,hy-2,hw-2,3,M); p(hx+1,hy-2,5,1,L);
        p(hx-1,hy,2,7,B); p(hx,hy+1,1,6,D);
        p(hx+hw-1,hy,2,7,B); p(hx+hw-1,hy+1,1,6,D);
        if(dir==='down'){
          p(hx+hw,  hy+2,3,11,B); p(hx+hw+1,hy+3,2,10,M); p(hx+hw+1,hy+3,1,8,L); // ponytail
          p(hx+hw,  hy+13,3,2,B); p(hx+hw+1,hy+13,2,1,D); // tip
        }
        if(dir==='up'){  // back — hair covers head, tail hangs centre-back
          p(hx,hy,hw,hh,B); p(hx+1,hy,hw-2,hh-1,D); p(hx+2,hy,hw-4,hh-2,M);
          p(hx+3,hy+hh-1,4,14,B); p(hx+4,hy+hh,3,13,D); p(hx+4,hy+hh+1,2,11,M);
          p(hx+3,hy+hh+13,4,3,B); p(hx+4,hy+hh+14,2,2,D); // tail tip
        }
      } else {
        p(hx,hy-2,hw+1,4,B); p(hx+1,hy-2,hw,3,M); p(hx+2,hy-2,5,1,L);
        if(dir==='right'){
          p(hx+hw-1,hy,1,7,B); p(hx+hw-2,hy+1,1,6,D);                          // sideburn at front
          p(hx-3,hy+2,3,13,B); p(hx-2,hy+3,2,12,M); p(hx-2,hy+3,1,10,L);      // ponytail at back
        } else {
          p(hx,hy,1,7,B); p(hx+1,hy+1,1,6,D);                                   // sideburn at front
          p(hx+hw,hy+2,3,13,B); p(hx+hw+1,hy+3,2,12,M); p(hx+hw+1,hy+3,1,10,L); // ponytail at back
        }
      }
    }
    // 1: Bun
    else if(hs===1){
      if(dir==='down'||dir==='up'){
        p(hx,hy-2,hw,3,B); p(hx+1,hy-2,hw-2,2,M); p(hx+2,hy-2,5,1,L);
        p(hx-1,hy,2,7,B); p(hx,hy+1,1,6,D);
        p(hx+hw-1,hy,2,7,B); p(hx+hw-1,hy+1,1,6,D);
        // bun
        p(hx+3,hy-6,5,5,B); p(hx+4,hy-5,4,4,M); p(hx+5,hy-5,3,3,L); p(hx+5,hy-5,2,1,L);
        if(dir==='up'){  // back — head covered, bun prominent from behind
          p(hx,hy,hw,hh,B); p(hx+1,hy,hw-2,hh-1,D); p(hx+2,hy,hw-4,hh-2,M);
          p(hx+2,hy-7,7,6,B); p(hx+3,hy-6,5,5,M); p(hx+4,hy-6,4,4,L); p(hx+4,hy-6,2,1,L);
        }
      } else {
        p(hx,hy-2,hw+1,3,B); p(hx+1,hy-2,hw,2,M);
        if(dir==='right'){
          p(hx+hw-1,hy,1,7,B); p(hx+hw-2,hy+1,1,6,D);  // sideburn at front (right)
          p(hx-4,hy-7,5,5,B); p(hx-4,hy-7,4,4,M);       // bun at back (left)
        } else {
          p(hx,hy,1,7,B); p(hx+1,hy+1,1,6,D);            // sideburn at front (left)
          p(hx+hw-1,hy-7,5,5,B); p(hx+hw,hy-7,4,4,M);   // bun at back (right)
        }
      }
    }
    // 2: Long & loose
    else if(hs===2){
      if(dir==='down'||dir==='up'){
        p(hx,hy-2,hw,4,B); p(hx+1,hy-2,hw-2,3,M); p(hx+1,hy-2,5,1,L);
        p(hx-2,hy,3,14,B); p(hx-1,hy+1,2,13,M); p(hx-1,hy+1,1,11,L);
        p(hx+hw-1,hy,3,14,B); p(hx+hw,hy+1,2,13,M);
        p(hx-2,hy+14,3,2,B); p(hx-1,hy+15,2,1,D);
        p(hx+hw-1,hy+14,3,2,B); p(hx+hw,hy+15,2,1,D);
        if(dir==='up'){  // back — full head + wide flowing mass behind
          p(hx,hy,hw,hh,B); p(hx+1,hy,hw-2,hh-1,D); p(hx+2,hy,hw-4,hh-2,M);
          p(hx-1,hy+hh,hw+2,12,B); p(hx,hy+hh+1,hw,11,D); p(hx+1,hy+hh+1,hw-2,9,M);
          p(hx-1,hy+hh+11,hw+2,3,B); p(hx,hy+hh+12,hw,1,D); // bottom hem
        }
      } else {
        p(hx,hy-2,hw+1,4,B); p(hx+1,hy-2,hw,3,M);
        if(dir==='right'){
          p(hx+hw-1,hy,1,14,B); p(hx+hw-2,hy+1,1,13,D); // sideburn at front (right)
          p(hx-3,hy,3,15,B); p(hx-2,hy+1,2,14,M);        // long hair at back (left)
        } else {
          p(hx,hy,1,14,B); p(hx+1,hy+1,1,13,D);           // sideburn at front (left)
          p(hx+hw,hy,3,15,B); p(hx+hw+1,hy+1,2,14,M);    // long hair at back (right)
        }
      }
    }
    // 3: Bob
    else if(hs===3){
      if(dir==='down'||dir==='up'){
        p(hx,hy-2,hw,4,B); p(hx+1,hy-2,hw-2,3,M); p(hx+1,hy-2,4,1,L);
        p(hx-2,hy,3,10,B); p(hx-1,hy+1,2,9,M); p(hx-1,hy+1,1,7,L);
        p(hx+hw-1,hy,3,10,B); p(hx+hw,hy+1,2,9,M);
        p(hx-2,hy+10,3,2,B); p(hx+hw-1,hy+10,3,2,B);
        if(dir==='up'){  // back — head covered + bob curtain, flat trim line
          p(hx,hy,hw,hh,B); p(hx+1,hy,hw-2,hh-1,D); p(hx+2,hy,hw-4,hh-2,M);
          p(hx-1,hy+hh,hw+2,8,B); p(hx,hy+hh+1,hw,7,D); p(hx+1,hy+hh+1,hw-2,5,M);
          p(hx-1,hy+hh+8,hw+2,2,B); // flat cut bottom
        }
      } else {
        p(hx,hy-2,hw+1,4,B); p(hx+1,hy-2,hw,3,M);
        if(dir==='right'){
          p(hx+hw-1,hy,1,10,B); p(hx+hw-2,hy+1,1,9,D);             // sideburn at front (right)
          p(hx-3,hy,3,11,B); p(hx-2,hy+1,2,10,M); p(hx-3,hy+10,3,2,B); // bob at back (left)
        } else {
          p(hx,hy,1,10,B); p(hx+1,hy+1,1,9,D);                      // sideburn at front (left)
          p(hx+hw,hy,3,11,B); p(hx+hw+1,hy+1,2,10,M); p(hx+hw,hy+10,3,2,B); // bob at back (right)
        }
      }
    }
    // 4: Braids
    else if(hs===4){
      if(dir==='down'||dir==='up'){
        p(hx,hy-2,hw,4,B); p(hx+1,hy-2,hw-2,3,M); p(hx+2,hy-2,4,1,L);
        p(hx-2,hy,3,15,B); p(hx-1,hy+1,2,14,M);
        for(let i=0;i<7;i++) p(hx-1,hy+1+i*2,1,1,D);
        p(hx+hw-1,hy,3,15,B); p(hx+hw,hy+1,2,14,M);
        for(let i=0;i<7;i++) p(hx+hw,hy+1+i*2,1,1,D);
        p(hx-2,hy+15,3,2,B); p(hx+hw-1,hy+15,3,2,B);
        if(dir==='up'){  // back — head covered, two braids from top-back
          p(hx,hy,hw,hh,B); p(hx+1,hy,hw-2,hh-1,D); p(hx+2,hy,hw-4,hh-2,M);
          for(let i=0;i<9;i++){ // left braid
            p(hx+1,hy+hh+i*2,3,1,B); p(hx+1,hy+hh+i*2,3,1,i%2===0?D:M);
          }
          for(let i=0;i<9;i++){ // right braid
            p(hx+hw-4,hy+hh+i*2,3,1,B); p(hx+hw-4,hy+hh+i*2,3,1,i%2===0?D:M);
          }
          p(hx,hy+hh+18,4,3,B); p(hx+1,hy+hh+19,2,2,D);
          p(hx+hw-4,hy+hh+18,4,3,B); p(hx+hw-3,hy+hh+19,2,2,D);
        }
      } else {
        p(hx,hy-2,hw+1,4,B); p(hx+1,hy-2,hw,3,M);
        if(dir==='right'){
          p(hx+hw-1,hy,1,15,B); p(hx+hw-2,hy+1,1,14,D); for(let i=0;i<7;i++) p(hx+hw-2,hy+1+i*2,1,1,M); // sideburn at front
          p(hx-3,hy,3,16,B); p(hx-2,hy+1,2,15,M);        // braid at back (left)
        } else {
          p(hx,hy,1,15,B); p(hx+1,hy+1,1,14,D); for(let i=0;i<7;i++) p(hx+1,hy+1+i*2,1,1,M); // sideburn at front
          p(hx+hw,hy,3,16,B); p(hx+hw+1,hy+1,2,15,M);    // braid at back (right)
        }
      }
    }
    // 5: Pixie cut
    else{
      if(dir==='down'||dir==='up'){
        p(hx,hy-2,hw,3,B); p(hx+1,hy-2,hw-2,2,M); p(hx+1,hy-2,6,1,L);
        p(hx,hy,  1,5,B); p(hx+1,hy,1,4,D);
        p(hx+hw-1,hy,1,5,B); p(hx+hw-2,hy,1,4,D);
        if(dir==='down') p(hx+2,hy-1,3,1,L);
        if(dir==='up'){  // back — short neat cap with slight taper
          p(hx,hy,hw,hh-3,B); p(hx+1,hy,hw-2,hh-4,D); p(hx+2,hy,hw-4,2,M);
        }
      } else {
        p(hx,hy-2,hw+1,3,B); p(hx+1,hy-2,hw,2,M); p(hx+2,hy-2,5,1,L);
        if(dir==='right'){ p(hx+hw-1,hy,1,5,B); p(hx+hw-2,hy,1,4,D); }
        else             { p(hx,hy,1,5,B); p(hx+1,hy,1,4,D); }
      }
    }
  }
}