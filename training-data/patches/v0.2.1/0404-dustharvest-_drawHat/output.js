function _drawHat(ctx,sx,byRef,HAT,B,dir){
  if(!HAT) return;
  const by=byRef;
  const p=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
  const D=HAT[0],M=HAT[1],L=HAT[2];
  const band=shadeColor(D,-15);
  if(dir==='down'||dir==='up'){
    // Crown: 10w × 6h, centered on sx
    p(sx-5,by-39,10,1,B);
    p(sx-5,by-39,10,6,B); p(sx-4,by-39,8,5,M); p(sx-3,by-38,5,3,L);
    p(sx-5,by-34,10,1,B); p(sx-4,by-34,8,1,band);
    // Brim: 16w × 3h
    p(sx-8,by-33,16,1,B);
    p(sx-8,by-33,16,3,B); p(sx-7,by-33,14,2,M); p(sx-6,by-33,10,1,L);
    p(sx-8,by-31,16,1,B);
    if(dir==='up'){ p(sx-4,by-39,8,5,D); }
  } else if(dir==='right'){
    // Crown: 8w × 6h centered on sx
    p(sx-4,by-39,8,1,B);
    p(sx-4,by-39,8,6,B); p(sx-3,by-39,6,5,D); p(sx-2,by-38,4,4,M); p(sx-1,by-38,2,2,L);
    p(sx-4,by-34,8,1,B); p(sx-3,by-34,6,1,band);
    // Brim: 13w centered, sx-6 to sx+6
    p(sx-6,by-33,13,1,B);
    p(sx-6,by-33,13,3,B); p(sx-5,by-33,11,2,M); p(sx-4,by-33,7,1,L);
    p(sx-6,by-31,13,1,B);
  } else {
    // Crown: 8w × 6h centered on sx
    p(sx-4,by-39,8,1,B);
    p(sx-4,by-39,8,6,B); p(sx-3,by-39,6,5,D); p(sx-2,by-38,4,4,M); p(sx-1,by-38,2,2,L);
    p(sx-4,by-34,8,1,B); p(sx-3,by-34,6,1,band);
    // Brim: 13w centered, sx-6 to sx+6
    p(sx-6,by-33,13,1,B);
    p(sx-6,by-33,13,3,B); p(sx-5,by-33,11,2,M); p(sx-2,by-33,7,1,L);
    p(sx-6,by-31,13,1,B);
  }
}