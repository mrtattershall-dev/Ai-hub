function cleanupAll(){
  stopTimers();
  for(const g of Object.values(mp.guests)) try{g.conn.close();}catch(_){}
  mp.guests={};
  if(mp.hostConn) try{mp.hostConn.close();}catch(_){}
  mp.hostConn=null;
  if(mp.peer) try{mp.peer.destroy();}catch(_){}
  mp.peer=null;
  mp.role=null; mp.peerId=null; mp.partnerReady=false; mp.remotePlayers={};
  updateBadge();
}