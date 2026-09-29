{*** Magic Maze v1.21 - PC version ***
 (This Pascal source is a $Ï#@&%*€ MESS!!  Sorry, pardon, excuse, blabla ;-)
  FREEWARE VERSION
		Coded by the MenThal [human name: Kent Dahl]
	Game project started:		   11-94
	Last code update:		 8/04-96      v1.2
                         10/3-99      v1.21
                         12/3-99      v1.22

Screen Update on a 486 DX 33:
 42ms - lev 10 GUS

 Test of several levels:
  34ms -lev 0->5 GUS

Screen Update on a Pentium 100Mhz
 21ms - lev 10 SB


Latest changes:
- End Sequence
- Removed Debugging play of End Seqence
+ Spell Damage inc.ed, as new enemies are introdused
+ maxSspr->57, 8 new enemies
+ SB vol.control
+ Start screen menu, SureYN() improved...
+ readded Performance Timing
+ In-game selection of add-on(Training) levels... Very stylish indeed!
+ Sound setup can be done with cmd-line parameters (GUS, SB & NOSOUND)
* MaxLevels->10
* RETURN/ENTER can also be used for selection
* Removed NumLock-locking-arrowkeys bug. (Only LastRELEASE is affected by NumLock)
* No MM_SAV.GAM doesn't make MM crash when trying to load a game.
** Crazy K renamed to MenThal (I thought the old handle was to ... silly...)
** Version up'd to 1.2

*** 10/03-1999 - Trying to fix the thing that crashes it in Win98...

Reported Bugs:
- GUSSetFreq in GUSUnit is comp. bonkers... (Try dividing real Hz with 40?!)
- There is a small 'click' when adjusting the GUS volume!? I Put in PLONK for SB
- SLLLOOOOOOWWW as HECK on a '386, but I've got a Pentium 100, so who cares?!

- 03-1999 - Crashes on Win98 due to the "Crt" I think... this also affects
  VOCUnit, so I'm removing it (and SB support too)
}
{$G+} {286 instructions allowed(The only reason why TP kinda sucks...)}
PROGRAM MagicMaze_Freeware;
USES FastVGA,PCXUnit,FastTimer,FastKeys,FastFonts,GusUnit,SoundGlobals,{VOCUnit,}Dos;
CONST
 {RegisteredVersion = False;}
 NameOfCreator       : string[40] = 'MenThal [alias Kent Dahl]';

 MapFileSignature: String = 'MagicMazeMap';
 MovX:Array[0..3] of ShortInt =( 0, 1, 0,-1); {0-Up, 1-Right, 2-Down, 3-Left}
 MovY:Array[0..3] of ShortInt =(-1, 0, 1, 0);
 {GameName = 'kd_game\MM_';{}
  GameName = 'MM_';{}
 MapSize = 32768;  MapHeaderSize = 256;
 SprBufSIze = 1030;
 MaxLevels = 10;
 MaxSpr = 57; MaxBackSpr = 29; {49->57}
 {MaxSpr = 7; MaxBackSpr = 9; {49->57}
 MaxNumSpr = 59;
 DefaultGameLoopDelay =100;  MinGameLoopDelay =50;  MaxGameLoopDelay =140;
 MonDelay = 7;
 GainManaDelay = 24;   LoseEnergyDelay = 256;
 MonsterPoints = 10;   ChestPoints = 50;     MoneyBagPoints = 250;
 MonsterToughness : ARRAY[0..19] of ShortInt = (4,13,19,25,31,38,44,51,57,63,70,76,83,89,95,101,108,114,120,127);
{Cast SpellTypes}
 SpellLightning = 0;    SpellBigBall = 1;    SpellCoolCube = 2;
 SpellMap = 3;    SpellHeal = 4;    SpellMana = 5;    SpellLookAhead = 6;

{Spell Data}
 Max2ndSpellTypes = 6;   Min2ndSPellType = 3;   MaxCastSpellTypes = 2;
 SpellDamage : ARRAY[0..MaxCastSpellTypes] of Byte = ( 4,  9, 20);
 SpellManaUse: ARRAY[0..MaxCastSpellTypes] of Byte = ( 1,  2,  4);

{SPrite Numbers}
 cSpells = 10;    cKeys = 30; {-32}   cLockedDoor = 33; {-35}
 cExit = 39;  cChest=20; cLifePotion=21; cManaPotion=22; cMoneyBag=23; cOrb=24;
 cMonsters = 40;   cBloodSplat = 9;
{PathBlocked codes}
 pbLockedDoor=2; pbMonster=16; pbPlayer=1; pbWall=8;
{Colors}
colRed = 20;   colGreen = 30;  colBlue = 40;
MaxNumMonsters = 255;
{Sound} MaxSam = 4; sndARGH = 1; sndZAP = 2; sndPunch = 3; sndBonus = 4;

{IMPORTANT}
NameOfCreatorBackup : string[40] = #154+#202+#220+#168+#208+#194+#216
  +#64+#182+#194+#216+#210+#194+#230+#64+#150+#202+#220+#232+#64+#136+#194+#208+#216+#186;
{ #134+#228+#194+#244+#242+#64+#150+#64
   +#182+#194+#216+#210+#194+#230+#64+#150+#202+#220+#232+#64+#136+#194+#208+#216+#186;
}
GSFXVoiceMax = 4;

{Keys}
scSelectAttackSpell = scAlt;       scTriggerAttackSpell = scCtrl;
scSelect2ndSpell = scTab;          scTrigger2ndSpell = scSpace;

 scSpellMap = scM;           scSpellHeal = scH;
 scSpellLookAhead = scL;     scSpellMana = scN;

 GUSSound = 1; SBSound = 2; NoSound = 0;
 GUSMaxVol = 60000;  GUSMinVol = 20000;  GUSVolStep = 2500;
 SBMaxVol = 255;     SBMinVol  = 1;      SBVolStep = 16;

TYPE MapType = Array[0..MapSize+MapHeaderSize] of Byte;

VAR BackSpr,Spr : Array [0..MaxNumSpr] of Pointer;
 MapBuf : ^MapType;
 DirInfo:SearchRec;
 pal,pal2:PaletteType;
 LevelExtension:String[3];
 s:String;
 Fil:File;
 x,y,i,j,SpellX,SpellY,PMana,PEnergy:Integer;
 MonWait,score,scoreBefore,GameLoopDelay,saveLevel,saveScore,
  NumMonsters,Level,w,UpdCounter,GUSVol,SBVol: Word;

 Deb1:Word;
 DefaultWall,a,b,GSFXVoice:Byte;
 PX,PY,PM:Byte; {Players X & Y coord, Move dir., Energy}
 MonX,MonY,MonType,MonM : ARRAY[1..MaxNumMonsters] of Byte;
 MonE : ARRAY[1..MaxNumMonsters] of ShortInt;
 SpellM,SpellPow,SpellType,CurrentSpell,Current2ndSpell : ShortInt;
 Keys : ARRAY[0..2] of Byte;
 ch:Char;
 GameOver,LevelExited,KeysChanged,bl,SoundOn,
  CurrentSPellChanged,Training:Boolean;

{Sound}
 SoundSetup : ShortInt;
 sam:ARRAY[1..MaxSam] of Pointer;
 gussam:ARRAY[1..MaxSam] of LongInt;
 samSize:Array[1..MaxSam] of longInt;

 l:LongInt;

{HELP SCREEN}
PROCEDURE ShowHelpScreen;
CONST Lines = 11;
 Text : ARRAY [1..Lines] of String[40]
  = ('Arrow keys move the old dude.',
  '  ',
  'CTRL :-  Fire attack spell',
  'ALT :-   Choose attack spell',
  '[F10] / Alt+Q :- Quit playing',
  '[H]: Heal          [M]: Magic Map',
  '[L]: Look ahead    [N]: Summon Mana',
  '[F9]: Restart level',
  '[F4]: Load game    [F5]: Save game',
  '[S]: Sound on/off',
  '[PgUp]/[PgDn]: Tune Volume'
  );
 GLDStep = 5;
BEGIN
 ClrVGAScr;
 VGAColor:=9;         FontWrite(0,0,' Magic Maze HELP! (Esc returns to game)');
 Line(0,14,319,14);
 VGAColor:=7;
 FOR w:=1 TO Lines DO
 BEGIN
  FontWrite(0,w*14+1,Text[w]);
 END;
 FontWrite(180,180,'Adjust with +/-');   FOntWrite(0,180,'Speed:');
 FadeToPalette(pal,0,255,10);
 REPEAT
  VGAColor:=0;  Box(60,180,160,199);
  VGAColor:=49; Line(60,180,160,199);
  VLine(Trunc((DefaultGameLoopDelay-MinGameLoopDelay)/(MaxGameLoopDelay-MinGameLoopDelay)*100)+60,185,194);
  b:=Trunc((GameLoopDelay-MinGameLoopDelay)/(MaxGameLoopDelay-MinGameLoopDelay)*100);
  VGAColor:=35;  Vline(b+60, 180,199);
  StartTimer;
  REPEAT
  UNTIL (LastPRess<>scF1);
  IF Key[scK] AND Key[scD] THEN {Little cheat mode}
  BEGIN Keys[0]:=3; KEys[1]:=3; Keys[2]:=3; Score:=0; PMana:=100;
   PEnergy:=100; KeysCHanged:=True;
  END;
  WaitFor(DefaultGameLoopDelay);
  IF Key[scGrayPlus] THEN GameLoopDelay:=GameLoopDelay-GLDStep;
  IF Key[scGrayMinus] THEN GameLoopDelay:=GameLoopDelay+GLDStep;
  IF GameLoopDelay>MaxGameLoopDelay THEN GameLoopDelay:=MaxGameLoopDelay;
  IF GameLoopDelay<MinGameLoopDelay THEN GameLoopDelay:=MinGameLoopDelay;
 UNTIL (LastPress=scEsc);
 FadeOut(10);
END;

FUNCTION ExtNum(I:Integer):String;
VAR s:String[5];
BEGIN
 s:=Chr( Ord('0') +   (Trunc(i/100) MOD 10));
 s:=s+Chr( Ord('0') + (Trunc(i/10) MOD 10));
 s:=s+Chr(Ord('0') +  (i MOD 10));
 ExtNum:=s;
END;

{ BITTEST(Byte,Digit) }
{ A Boolean function that tests a bit in a byte to see if it is set}
FUNCTION BitTest(b,d:Byte):Boolean;
CONST  bitset : ARRAY[0..7] of Byte = (1,2,4,8,16,32,64,128);
BEGIN
 IF (b AND bitset[d])=bitset[d] THEN BitTest:=TRUE ELSE BitTest:=FALSE;
END;

PROCEDURE SetGUSVol(v:Word);  {Sets the volume for ALL the channels}
VAR i:ShortInt;
BEGIN
 IF SoundSetup=GUSSound {GUS!} THEN
 BEGIN
  For i:=1 TO 31 DO GUSSetVolume(i,v);
  GUSVol:=v;
 END;
END;

PROCEDURE SetSBVol(v:Word);
BEGIN
 SBVol:=v;
 SetVolume(VoiceVol,BothChannels,SBVol);
END;

PROCEDURE Load_Set_Level;   {Loads and sets the next level}
VAR LevelOk : Boolean;
BEGIN
 CopyToPage2;
 VGAColor:=0; BoxPage2(16,16,175,175);
 REPEAT {Until level is OK}
  IF Not(Training) THEN LevelExtension:=ExtNum(Level);
  {IF {(ParamStr(1)<>'') AND}{ (Training) THEN Assign(Fil,GameName+'map.'+LevelExtension)
   ELSE Assign(Fil,GameName+'map.'+s);}
  Assign(Fil,GameName+'map.'+LevelExtension);
  FOR w:=0 TO (MapSize+MapHeaderSize) DO MapBuf^[w]:=0;  {Clear the game area}
  Reset(fil,1);
  BlockRead(fil,MapBuf^,MapSize,w);     {Read level data}
  Close(fil);

  LevelOk:=False;
  w:=0; { Check word sized checksum of main level data }
  FOR l:=MapHeaderSize TO MapSize+MapHeaderSize DO w:=w+MapBuf^[l];
  IF (MapBuf^[16]=w mod 256) AND (MapBuf^[17]=w div 256)
   THEN LevelOk:=True; {Level is original level}

 {Set up player}
 IF (PEnergy<90) THEN PEnergy:=90;
 IF (PMana<80) THEN PMana:=80;
 Keys[0]:=0; Keys[1]:=0; Keys[2]:=0;  KeysChanged:=True;
 {Look into the MapHeader}
 PX:=MapBuf^[24];  {Get start coord}
 PY:=MapBuf^[25];
 DefaultWall:=MapBuf^[30];
 IF DefaultWall=0 THEN DefaultWall:=10;
 NumMonsters:=0;   {Read through the monsters, 'n' make them LIVE!!}
 FOR y:=0 TO 127 DO
 FOR x:=0 TO 127 DO
 BEGIN
  b:=MapBuf^[y*256+x*2+MapHeaderSize+1]; {Map(x,y,a,b,bl); }
  IF (b>=cMonsters) AND (b<cMonsters+20) THEN
  BEGIN
    IF numMonsters<MaxNumMonsters THEN Inc(NumMonsters);
    MonX[NumMonsters]:=x;    MonY[NumMonsters]:=y;
    MonType[NumMonsters]:=b-cMonsters;
    MonE[NumMonsters]:=MonsterToughness[b-cMonsters];
    MapBuf^[y*256+x*2+1+MapHeaderSize]:=0; {SetBMap(0,x,y);   }
  END;
 END;
 SaveLevel:=Level;   SaveScore:=Score;
   {Tell name of level and number}
   FadeOut(10);
   ClrVgaScr;
   VGAColor:=8;
   FOntWrite(64,64,'Entering level '+LevelExtension);
   s:='';   a:=128;
   REPEAT
    s:=s+Chr(MapBuf^[a]);
    Inc(a);
   UNTIL (MapBuf^[a]<32) OR (a>166);

   {Debug} IF NOT(LevelOK) THEN     {ONLY FREEWARE VERSION}
   BEGIN
     s:=')-: Skipping ILLEGAL LEVEL !!! :-(';
     PEnergy:=1; PMana:=1;
   END;

   x:=(160-(Length(s)*4));
   FontWrite(x,100,s);
   FadeToPalette(pal,0,255,10);
   LastPress:=0; REPEAT UNTIL LastPress<>0;   LastPress:=0;
   FadeOut(10);

   IF Not(LevelOk) THEN Inc(Level);
 UNTIL LevelOk;
 CopyFromPage2;    FadeToPalette(pal,0,255,10);
END; {Load_Set_Level proc}

PROCEDURE RestartLevel;  {restarts level, and gives initial score}
BEGIN
  Level:=SaveLevel;
  Score:=SaveScore;
  scoreBefore:=score+1;
  CurrentSpellChanged:=True;
  Load_set_Level;
END;


PROCEDURE SaveSaveGame;
BEGIN
  SetRGB(0,0,63,0);
  Assign(fil,GameName+'sav.gam');
  Rewrite(fil,1);
  BlockWrite(fil,SaveLevel,2);
  BlockWrite(fil,SaveScore,2);
  Close(fil);
  VSync;
  SetRGB(0,0,0,0);
END; {SaveSaveGame proc}

PROCEDURE LoadSaveGame;
BEGIN
 FindFirst(GameName+'sav.gam',Archive+ReadOnly, DirInfo);
 IF DosError=0 THEN
 BEGIN
  SetRGB(0,0,0,60);
  Assign(fil,GameName+'sav.gam');
  Reset(fil,1);
  BlockRead(fil,SaveLevel,2);
  BlockRead(fil,SaveScore,2);
  Close(fil);
  {RestartLevel;}
  VSync;
  SetRGB(0,0,0,0);
 END
 ELSE BEGIN SaveLevel:=1; SaveScore:=0; END;
END; {LoadSaveGame proc}

Function SureYN(x,y:Integer;Str:String):Boolean;
VAR B:Boolean;
BEGIN
 VGAColor:=0; Box(x,y,159+x,95+y); {16,48}
 VGAColor:=7; Rectangle(x,y,159+x,95+y);
 VGAColor:=8;
 FontWrite(x+23,y+8,'Do you want to');
 FOntWrite(x+82-Length(str)*4,y+28,Str);
 FontWrite(x+67,y+48,'???');
 FontWrite(x+15,y+70,'([Y]es or [N]o?)');
 b:=False;
 REPEAT
  IF Key[scY] THEN b:=True;
 UNTIL (b) or (Key[scN]) OR (Key[scEsc]);
 SureYN:=b;
END; {SureYN proc}

PROCEDURE PlaySnd(snd:Byte);
BEGIN
 IF SOundOn THEN
 CASE SOundSetup OF
  GUSSound:{GUS!!!}
 BEGIN
  Inc(GSFXVoice);
  IF GSFXVoice>GSFXVoiceMax THEN GSFXVoice:=1;
  CASE snd OF
   sndARGH:
    BEGIN
     GUSSetFreq(GSFXVoice,555);{22 222 Hz????}
     GUSPlayVoice(GSFXVoice,0,gussam[snd],gussam[snd],gussam[snd]+samSize[snd]);
    END;
   sndZAP:
    BEGIN
     GUSSetFreq(GSFXVoice,555);
     GUSPlayVoice(GSFXVoice,0,gussam[snd],gussam[snd],gussam[snd]+samSize[snd]);
    END;
   sndPunch:
    BEGIN
     GUSSetFreq(GSFXVoice,555);
     GUSPlayVoice(GSFXVoice,0,gussam[snd],gussam[snd],gussam[snd]+samSize[snd]);
    END;
   sndBonus:
    BEGIN
     GUSSetFreq(GSFXVoice,200);
     GUSPlayVoice(GSFXVoice,0,gussam[snd],gussam[snd],gussam[snd]+samSize[snd]);
    END;
  END;{GUS CASE}
  END;{GUS}
  SBSound:
  {CASE snd OF
   {sndARGH: BackPlaySAM (sam[snd], 22222, Mono, samSize[snd], Once);
   sndZAP: BackPlaySAM (sam[snd], 22222, Mono, samSize[snd], Once);
   sndPunch: BackPlaySAM (sam[snd], 22222, Mono, samSize[snd], Once);
   sndBonus: BackPlaySAM (sam[snd], 8000, Mono, samSize[snd], Once);
   ...trying to fix Win98 bug
  END;}
 END;{OUTER CASE}
END; {PlaySnd proc}

PROCEDURE IncVolume;
BEGIN
 IF (SoundSetup=GUSSound) and (GUSVol<GUSMaxVol-GUSVolStep) {Sets the Volume for GUS}
  THEN SetGUSVol(GUSVol+GUSVolStep);
 IF (SoundSetup=SBSound) and (SBVol<SBMaxVol-SBVolStep)
  THEN SetSBVol(SBVol+SBVolStep);
 PlaySnd(sndBonus);
END;

PROCEDURE DecVolume;
BEGIN
 IF (SoundSetup=GUSSound) and (GUSVol-GUSVolStep>GUSMinVol) {Sets the Volume for GUS}
  THEN SetGUSVol(GUSVol-GUSVolStep);
 IF (SoundSetup=SBSound) and (SBVol-SBVolStep>SBMinVol)
  THEN SetSBVol(SBVol-SBVolStep);
 PlaySnd(sndBonus);
END;


PROCEDURE SetAMap(A:Byte; x,y:Byte); {Sets the A byte at a given coord}
BEGIN
 IF {(x>=0) AND} (x<128) {AND (y>=0)} AND (y<128) THEN
	 MapBuf^[y*256+x*2+MapHeaderSize]:=a; {146/65536ms}
    {MapBuf^[((y+1) shl 8)+(x shl 1)]:=a; {146/65536ms}
END; {SetAMap proc}

PROCEDURE SetBMap(b:Byte; x,y:Byte); {Sets the B byte at a given coord}
BEGIN
 IF {(x>=0) AND} (x<128) {AND (y>=0)} AND (y<128) THEN
	 MapBuf^[y*256+x*2+1+MapHeaderSize]:=b;
END; {SetBMap proc}

{MAP - x,y:Coord,  a,b,block:Returns data(wall,objects,blocked
 Time consume: 301/65536 ms if x and y in range
 MapHeaderSize MUST BE 256 !}
PROCEDURE Map(x,y:ShortInt; var a,b:Byte; var Block:Boolean);
VAR w:Word;
BEGIN
 IF ((x and 128)=0) AND ((y and 128)=0) THEN
	BEGIN
    asm
     mov ah,[y]
     inc ah
     mov al,[x]
     shl al,1
     mov [w],ax
    end;{301/65536ms }
    {asm
     mov ax,[w]
     les di,[MapBuf]
     mov di,ax
     mov al,[es:di]
     mov byte [a],al
     inc di
     mov al,[es:di]
     mov byte [b],al
    end;
    }
    a:=MapBuf^[w]; b:=MapBuf^[w+1];
    {Test bit 7}
    IF (a AND 128)=128 THEN BEGIN Block:=True; a:=a and 127;
                             END Else BLock:=False;

	END
 ELSE
	BEGIN
	 a:=DefaultWall; b:=0; BLock:=True;
	END;
END; {Map Proc.}



{MAP - x,y:Coord,  a,b,block:Returns data(wall,objects,blocked
 Time consume: 304/65536 ms if x and y in range}
PROCEDURE MapZ(x,y:Integer; var a,b:Byte; var Block:Boolean);
VAR w:Word;
BEGIN
 IF (x>=0) AND (x<128) AND (y>=0) AND (y<128) THEN
	BEGIN
    {w:=((y+1) shl 8)+(x shl 1);  {A bit faster, 334/65536ms, but must be changed if MapHeaderSize is}
	 {w:=y*256+x*2+MapHeaderSize; {}
    asm
     mov ax,[y]
     inc ax
     shl ax,8
     mov bx,[x]
     shl bx,1
     add ax,bx
     mov [w],ax
     {mov ah,[y]
     inc ah
     mov bl,[x]
     mov bh,0
     shl bx,1
     add bh,ah
     mov [w],bx}
    end;{324/65536ms }
	 a:=MapBuf^[w]; b:=MapBuf^[w+1];
    {Test bit 7}
	 IF (a AND 128)=128 THEN BEGIN Block:=True; a:=a and 127;
                             END Else BLock:=False;

	END
 ELSE
	BEGIN
	 a:=DefaultWall; b:=0; BLock:=True;
	END;
END; {Map Proc.}

PROCEDURE ScreenUpdate(ViewX,ViewY:Integer);   {Updates the screen}
VAR x,y,xx,yy,xxx,yyy:Integer;
 a,b:Byte; bl:Boolean;
BEGIN
{ VGAColor:=0;
  BoxPage2(16,16,175,175);} {Removed. More speed, less error proof.}
 FOR y:=-2 TO 2 DO
 FOR x:=-2 TO 2 DO
 BEGIN
   xx:=ViewX+x;     yy:=ViewY+y;
	xxx:=80+x*32;    yyy:=80+y*32;
	Map(xx,yy,a,b,bl);
   IF (a=0) AND (xx AND 2=2) AND (yy AND 2=2) THEN a:=1;{Vary ground}
	IF a<=MaxBackSpr THEN PutImagePage2(xxx,yyy,BackSpr[a]^,CopyPut);
	IF (b>0) AND (b<=MaxSpr) THEN PutImagePage2(xxx,yyy,Spr[b]^,TransPut);
 END;

 xx:=px-ViewX;
 IF Abs(xx)<3 THEN
 BEGIN
  yy:=py-ViewY;
  IF Abs(yy)<3 THEN
  BEGIN
   xx:=xx*32+80;   yy:=yy*32+80;
   PutImagePage2(xx,yy,Spr[PM]^,TransPut);  {Put a pic of our little good dude}
  END;
 END;

 FOR i:=1 TO NumMonsters DO  {Place monsters (Should be a bit faster)}
 IF MonE[i]>0 THEN
 BEGIN
  xx:=MonX[i]-ViewX;
  IF Abs(xx)<3 THEN
  BEGIN
   yy:=MonY[i]-ViewY;
   IF (Abs(yy)<3) THEN
   BEGIN
     PutImagePage2((xx*32+80),(yy*32+80),Spr[MOnType[i]+cMonsters]^,TransPut);
   END;
  END;
 END;

 {Place spell}
 IF SPellPow>0 THEN
 BEGIN
   xx:=SPellX-ViewX;
   IF (Abs(xx)<3) THEN
   BEGIN
    yy:=SpellY-ViewY;
    IF (Abs(yy)<3) THEN
    PutImagePage2((xx*32+80),(yy*32+80),Spr[cSpells+SpellType]^,TransPut);
   END;
 END;

 Vsync;
 CopyBlockFromPage2(16,16,175,175); {Show playing grid}

 VGAColor:=0;       {Show mana+energy}
 {Vsync;} Box(215,57,315,72);
 IF PEnergy>0 THEN BEGIN VGAColor:=19; Box(215,57,215+PEnergy,64); END;
 IF PMana>0   THEN BEGIN VGAColor:=38; Box(215,65,215+PMana,72);   END;

 {Show current spell, if necessary}
 IF CurrentSpellChanged THEN
 BEGIN
   PutImage(180,16,Spr[CurrentSpell+cSpells]^,CopyPut);
   CurrentSPellChanged:=False;
 END;

 IF KeysChanged THEN
 BEGIN
  {Vsync;   {Show our keys}
  VGAColor:=0; Box(215,16,318,47);
  x:=215;
  FOR xx:=0 TO 2 DO
  BEGIN
 	IF Keys[xx]>0 THEN FOR y:=1 TO Keys[xx] DO
 	 IF y<4 THEN
 	 BEGIN PutImage(x,16,Spr[cKeys+xx]^,TransPut); x:=x+7; END;
  END;
  KeysChanged:=False;
 END;

 IF score<>scoreBefore THEN  {Place score on tha screen, if it has changed}
 BEGIN
  VGAColor:=0;   Box(215,77,314,90);
  VGAColor:=7;   Str(Score:11,s);    FontWrite(215,77,s);
  scoreBefore:=score;
 END;

END;{ScreenUpdate Proc.}


FUNCTION PathBlocked(x,y:Byte) : Byte;    {Test if path is blocked}
{RETURNS:- 2=LockedDoor, 16=Monster, Player=1, Wall=8}
VAR pb,a:Byte; i:Word;
BEGIN
	Map(x,y,a,b,bl);
   IF bl THEN pb:=pbWall ELSE pb:=0;
   FOR i:=1 TO numMonsters DO
      IF (MonX[i]=x) AND (MonY[i]=Y) AND (MonE[i]>0) THEN pb:=pbMonster;
   IF (x=PX) AND (y=PY) THEN pb:=pbPlayer;
   IF (b>=cLockedDoor) AND (b<=cLockedDoor+2) THEN pb:=pbLockedDoor;
 PathBLocked:=pb;
END; {PathBlocked Proc.}

{*** MAIN GAME LOOP PROCEDURE ***}
PROCEDURE DoGameLoop;
VAR xPM:Integer;
 PROCEDURE TryToMove; {Tries to move player one step in his standing direction}
 VAR bl:Byte;         { if it is possible}
 BEGIN
   bl:=PathBlocked(PX+MovX[pm],PY+MovY[pm]);
   IF (Keys[b-cLockedDoor]>0) AND (bl=pbLockedDoor) THEN
	BEGIN {Use a key to open door if possible }
	  Dec(Keys[b-cLockedDoor]); SetBMap(0,px+MovX[pm],PY+MovY[pm]);
     bl:=0; KeysChanged:=True;
	END;
   IF GameOver THEN bl:=1;
	IF bl=0 THEN BEGIN	 px:=px+MovX[pm]; py:=Py+MovY[pm];	END;
 END;{TryToMove Proc.}

PROCEDURE  TryToMoveMonster;    {?? 94ms/65536}
 {Moves more random, and seemingly more intelligent, but uses twice the time}
VAR j,m,mp:Integer; jp:ARRAY[0..3] of INteger;
BEGIN
 IF MonE[i]>0 THEN   {If they still are alive, move'em towards player}
  BEGIN
    FOR j:=0 TO 3 DO jp[j]:=0+Random(35)+175;
    IF py<MonY[i] THEN
       BEGIN jp[0]:=jp[0]+1000; {Up}    jp[2]:=jp[2]-200;END ELSE
    IF py>MonY[i] THEN
       BEGIN jp[2]:=jp[2]+1000; {Down}  jp[0]:=jp[0]-200; END;
    IF px>MonX[i] THEN
       BEGIN jp[1]:=jp[1]+1000; {Right} jp[3]:=jp[3]-200;END ELSE
    IF px<MOnX[i] THEN
       BEGIN jp[3]:=jp[3]+1000; {Left}  jp[1]:=jp[1]-200; END;
    y:=MonY[i]+MovY[j];
    x:=MonX[i]+MovX[j];
    mp:=-3000; m:=-1;
    FOR j:=0 TO 3 DO
    BEGIN
     IF j=MonM[i] THEN jp[j]:=jp[j]+15;
     IF PathBlocked(MonX[i]+MovX[j],MOnY[i]+MovY[j])<>0 THEN jp[j]:=0;
     IF jp[j]>mp THEN BEGIN m:=j; mp:=jp[j]; END;
    END;
   IF mp>0 THEN
   BEGIN
    MonY[i]:=MonY[i]+MovY[m]; MonX[i]:=MonX[i]+MovX[m]; MonM[i]:=m;
   END;
  END;
END;

BEGIN   {DoGameLoop}
 FadeToPalette(pal,0,255,10);
 REPEAT {Outer loop}
  StartTimer;
  Map(PX,PY,a,b,bl);
  IF (b>=cKeys) AND (b<=cKeys+2) THEN  {If we're standin on a key}
  IF Keys[b-cKeys]<3 THEN   {And we ain't carrying too many}
  BEGIN
    Inc(Keys[b-cKeys]); SetBMap(0,px,py);  {Grab it!}
    KeysChanged:=True;
    PlaySnd(sndBonus);
  END;
  CASE b OF
 	cChest :BEGIN Score:=Score+ChestPoints; SetBMap(0,px,py); PlaySnd(sndBonus); END; {Chests give points}
 	cLifePotion : IF PEnergy<75 THEN
                      BEGIN PEnergy:=PEnergy+25; SetBMap(0,px,py); PlaySnd(sndBonus); END;
	cManaPotion : IF PMana<80 THEN
                     BEGIN PMana:=PMana+20; SetBMap(0,px,py); PlaySnd(sndBonus); END;
   cMoneyBag   : BEGIN Score:=score+MoneyBagPoints; SetBMap(0,px,py); PlaySnd(sndBonus); END;
   cOrb        : IF (PEnergy+PMana<170) THEN
                     BEGIN SetBMap(0,px,py); PlaySnd(sndBonus); PMana:=100; PEnergy:=100; END;
	cExit : BEGIN GameOver:=True; LevelExited:=True;	END;
  END;

 screenupdate(px,py);
 {xPM:=-1;}
 IF key[scUp] THEN IF PM=0 THEN TryToMove ELSE PM:=0; {IF PM<>xPM THEN xPM:=0; {}
 IF key[scRight] THEN IF PM=1 THEN TryToMove ELSE PM:=1;{}
 IF key[scDown] THEN IF PM=2 THEN TryToMove ELSE PM:=2;{}
 IF key[scLeft] THEN IF PM=3 THEN TryToMove ELSE PM:=3;{}

 {IF xPM<>-1 THEN   IF xPM=PM THEN TryToMove ELSE PM:=xPM;}

 IF (PEnergy<1) THEN
      BEGIN GameOVer:=True; LevelExited:=False; PEnergy:=0; END;
{IF PEnergy<1  THEN GameOver:=True; {Out of energy = out of the game}


 IF (Key[scTriggerAttackSpell]) THEN
 BEGIN{IfFire}
  {Lightning spell}
  IF (CurrentSpell=SpellLightning) THEN
   IF (PMana>SpellManaUse[SPellLightning]) AND (SpellPow<2) THEN
    BEGIN  SpellType:=SPellLightning; PMana:=PMana-SpellManaUse[SPellLightning];
      SpellPow:=7; SpellX:=PX; SPellY:=PY; SpellM:=PM; PlaySnd(sndZAP);
    END;

  {BigBall spell}
  IF (CurrentSpell=SpellBigBall)  THEN
   IF (PMana>SpellManaUse[SPellBigBall]) AND (SpellPow<2) THEN
    BEGIN  SpellType:=SPellBigBall; PMana:=PMana-SpellManaUse[SPellBigBall];
      SpellPow:=8; SpellX:=PX; SPellY:=PY; SpellM:=PM; PlaySnd(sndZAP);
    END;

  {CoolCube spell}
  IF (CurrentSpell=SpellCoolCube) THEN
   IF (PMana>SpellManaUse[SPellCoolCube]) AND (SpellPow<2) THEN
    BEGIN  SpellType:=SPellCoolCube; PMana:=PMana-SpellManaUse[SPellCoolCube];
      SpellPow:=10; SpellX:=PX; SPellY:=PY; SpellM:=PM; PlaySnd(sndZAP);
    END;
 END;{IfFire}


 IF SpellPOW>0 THEN  {Move spell if still there}
 BEGIN
  Dec(SpellPow);
  SpellX:=SpellX+MovX[spellM];
  SpellY:=SpellY+MovY[spellM];
  IF (NOT(PathBLocked(SpellX,SpellY) IN[0,16])) AND (SPellPow>0) {If wall}
     THEN  SpellPow:=1; {Make show on the wall it smacks into}
 END;

 FOR i:=1 TO numMonsters DO {Do this no matter if the monsters are ready}
  IF MonE[i]>0 THEN      {If they are alive}
  BEGIN
    x:=Abs(MonX[i]-PX);
    y:=Abs(MonY[i]-PY);
    IF ((x<2) AND (y<2))   {'n' close to player ; suck his energy out}
        AND ((x=0) OR (y=0)) THEN BEGIN Dec(PEnergy); PlaySnd(sndPunch); END;
    IF (SpellPow>1) THEN  {'n' near spell, get hit, and absorb the spell}
     IF ((MOnX[i]=SpellX) AND (MonY[i]=SPellY)) {BUG:- OR  ((MOnX[i]-MovX[SpellM]=SpellX) AND (MonY[i]-MovY[SpellM]=SPellY))}
      THEN
       BEGIN
        MonE[i]:=MonE[i]-SpellDamage[SpellType]; SpellPow:=1;
        IF MonE[i]<1 THEn
        BEGIN
          MonE[i]:=0; Score:=Score+MonsterPoints; PlaySnd(sndARGH);
          Map(MonX[i],MonY[i],a,b,bl);
          IF b=0 THEN SetBMap(cBloodSplat,MOnX[i],MonY[i]);
        END;
       END;
 END;

 IF MonWait>MonDelay THEN MonWait:=0;{}
{Following code spreads some of the MonsterMoving onto several updates. This
speeds the game a bit up on levels with many enemies}
  CASE MonWait OF
   0:          FOR i:=1 TO (NumMonsters div 8) DO TryToMoveMonster;
   MonDelay:   FOR i:=(NumMonsters div 8)+1 TO (NumMonsters*2 div 8) DO TryToMoveMonster;
   MonDelay-1: FOR i:=(NumMonsters div 4)+1 TO ((NumMonsters*3 div 8)) DO TryToMoveMonster;
   MonDelay-2: FOR i:=(NumMonsters*3 div 8)+1 TO ((NumMonsters div 2)) DO TryToMoveMonster;
   MonDelay-3: FOR i:=(NumMonsters div 2)+1 TO ((NumMonsters*5 div 8)) DO TryToMoveMonster;
   MonDelay-4: FOR i:=(NumMonsters*5 div 8)+1 TO ((NumMonsters*3 div 4)) DO TryToMoveMonster;
   MonDelay-5: FOR i:=(NumMonsters*3 div 4)+1 TO ((NumMonsters*7 div 8)) DO TryToMoveMonster;
   MonDelay-6: FOR i:=(NumMonsters*7 div 8)+1 TO (NumMonsters) DO TryToMoveMonster;
   {/2 -> shr 1       /4 -> shr 2}
  END;

 Inc(MonWait);

 IF LastPress=scSelectAttackSpell THEN
 BEGIN
  Inc(CurrentSpell); IF CurrentSpell>MaxCastSpellTypes THEN CurrentSpell:=0;
  CurrentSpellChanged:=True;
 END;

 IF (Key[scPgUp]) THEN IncVolume; {and (GUSVol<GUSMaxVol-GUSVolStep) {Sets the Volume for GUS}
 { THEN SetGUSVol(GUSVol+GUSVolStep); }
 IF (Key[scPgDn]) THEN DecVolume; {and (GUSVol>GUSMinVol+GUSVolStep)
  THEN SetGUSVol(GUSVol-GUSVolStep);}

 IF (PMana<100) AND (UpdCounter MOD GainManaDelay = 0) THEN Inc(PMana);
 IF (PEnergy>3) AND (UpdCounter MOD LoseEnergyDelay = 0) THEN Dec(PEnergy);

 IF (LastPress=scS) THEN SoundOn:=Not(SoundOn);

 {Debug} IF TimerTicks>Deb1 THEN Deb1:=TimerTicks; {}

  IF {((LastPress=scTrigger2ndSPell) AND (Current2ndSPell=SpellHeal)) OR }
 (LastPress=scSPellHeal)
  THEN IF (PMana>2) AND (PEnergy<97) THEN  {Heal spell}
   BEGIN
    w:=CurrentSpell;  CurrentSpell:=SpellHeal;  CurrentSpellChanged:=True;
    ScreenUpdate(px,py);
    While Key[scSpellHeal] AND (Pmana>2) AND (PEnergy<97) DO
     BEGIN Dec(PMana);Dec(PMana); Inc(PEnergy); INC(PEnergy);
      StartTimer; ScreenUpdate(px,py); WaitFOr(GameLoopDelay); END;
    CurrentSpell:=w;    CurrentSpellChanged:=True;
   END;

  IF  (LastPress=scSPellMana)
  THEN IF (PMana<97) AND (PEnergy>20) THEN  {Mana spell}
   BEGIN
    w:=CurrentSpell;   CurrentSpell:=SpellMana;  CurrentSpellChanged:=True;
    ScreenUpdate(px,py);
    While Key[scSpellMana] AND (Pmana<97) AND (PEnergy>20) DO
     BEGIN PMana:=PMana+2; PEnergy:=PEnergy-3;
      StartTimer; ScreenUpdate(px,py); WaitFOr(GameLoopDelay); END;
    CurrentSpell:=w;   CurrentSpellChanged:=True;
   END;

 IF {((LastPress=scTrigger2ndSPell) AND (Current2ndSPell=SpellMap))}
  (LastPress=scSPellMap)
  THEN IF  (PMana>0) THEN  {Game Map function}
  BEGIN
   REPEAT UNTIL Not(Key[lastPress]);
   CurrentSPellChanged:=True;   w:=CurrentSpell;   CurrentSpell:=SpellMap;
   ScreenUpdate(px,py);
   VGAColor:=0; Box(16,16,175,175);
   LastPress:=00;    LastRelease:=00;
   FOR x:=-3 TO 130 DO FOR y:=-3 TO 130 DO
   BEGIN
    a:=PathBlocked(x,y);
    b:=0;
    CASE a OF
     pbWall:       b:=255;
     pbMonster:    b:=colRed;
     pbLockedDoor: b:=colGreen;
     pbPlayer:     b:=colBlue;
    END;
    VGAScreen[32+y][32+x]:=b;
    VGAColor:=colBlue; Box(px+31,py+31,px+33,py+33);
   END;
   Dec(PMana);
   REPEAT UNTIL (Key[scSPellMap]) OR (Key[scEsc]);
    REPEAT UNTIL Not(Key[scSPellMap]) AND NOt(Key[scEsc]);
   LastPress:=00;               LastRelease:=00;
   CurrentSPellChanged:=True;   CurrentSpell:=W;
  END;

  IF (LastPress=scSpellLookAhead) {((LastPress=scTrigger2ndSPell) AND (Current2ndSPell=SpellLookAhead))}
   AND (PMana>0) THEN   {Look ahead spell}
 BEGIN
   w:=CurrentSpell;
   CurrentSpell:=SpellLookAhead;   CurrentSpellChanged:=True;
   REPEAT UNTIL LastPress=LastRelease;
   LastPress:=0;
   SpellType:=6;   SpellPow:=2;
   SpellX:=px;     SPellY:=py;
   REPEAT
    ScreenUpdate(SPellX,SpellY);
    StartTimer;
     IF key[scUp] THEN IF SpellY>0 THEN BEGIN Dec(SpellY);Dec(PMana);END;
     IF key[scRight] THEN IF SpellX<128 THEN BEGIN Inc(SPellX);Dec(PMana);END;
     IF key[scDown] THEN IF SpellY<128 THEN BEGIN INc(SpellY);Dec(PMana);END;
     IF key[scLeft] THEN IF SpellX>0 THEN BEGIN Dec(SpellX);Dec(PMana);END;
    WaitFor(GameLoopDelay);
   UNTIL (LastPress=scSPellLookAhead) OR (LastPress=scEsc) OR (PMana<1);
   CurrentSpell:=w;   CurrentSpellChanged:=True;
   StartTimer;
   ScreenUpdate(SpellX,Spelly);
   SpellPow:=0;
   LastPress:=0;
   WaitFor(GameLoopDelay*2);
 END;

 IF (Key[scF9]) THEN  IF SureYN(16,48,'restart the level') THEN RestartLevel;
 IF (Key[scF1]) THEN
   BEGIN CopyBlockToPage2(0,0,319,199); FadeOut(10);
         ShowHelpScreen;
         CopyFromPage2;
         screenupdate(px,py); FadeToPalette(pal,0,255,10);
   END;
 IF (Key[scF4]) THEN IF SureYN(16,48,'load a saved game') THEN
              BEGIN LoadSaveGame; RestartLevel; END;
 IF (Key[scF5]) AND Not(Training) THEN IF SureYN(16,48,'save current game')
              THEN SaveSaveGame;
 IF (key[scF10]) OR ((Key[scAlt]) AND (Key[scQ])) THEN
      IF SureYN(16,48,'quit this game') THEN
      BEGIN GameOVer:=True; LevelExited:=False; PEnergy:=0; END;

 LastPress:=00;   LastRelease:=00;
 WaitFor(GameLoopDelay);

 Inc(UpdCounter);
UNTIL GameOver; {OuterLoop; }

 IF LevelExited=True THEN
 BEGIN
   pal2:=pal;   FOR i:=61 TO 70 DO pal2[i-61+241]:=pal2[i];
   FOR i:=16 TO 80 DO
   BEGIN VGAColor:=i mod 10+241; Rectangle(96-i,96-i,95+i,95+i);
    SLidePalette(pal2,250,241); SetActivePalette(pal2,241,250);
    StartTimer; VSync; WaitFOr(GameLoopDelay shr 2);
   END;
   FadeToRGB(0,0,63,20);
 END;
 IF PEnergy<1 THEN
  BEGIN
   PlaySnd(sndARGH);
   VGAColor:=2; Box(79,79,259,107);   VGAColor:=0; Box(80,80,258,106);
   FOR i:=3 TO 9 DO
    BEGIN VGAColor:=i; FontWrite(92-i,92-i,'G A M E   O V E R ! !'); END;
   StartTimer; WaitFor(GameLoopDelay);
   FadeToRGB(63,0,0,20);
   VSync;    ClrVGAScr;
  END;
 FadeOut(20);
END;

PROCEDURE PlayEndSequence;
CONST NumLines = 33;
 Text : Array[0..NumLines] of RECORD Txt:String[40]; Col:Byte; END =
  ( (Txt:'LuciPer escapes into the dimension';Col:255)
   ,(txt:'bettter known as....';Col:255)
   ,(txt:'--++**++--';Col:colRed)
   ,(txt:'-> HELL <-';Col:colRed)
   ,(txt:'--++**++--';Col:colRed)
   ,(txt:'';Col:0)
   ,(txt:'The world is once again safe...';Col:colBlue)
   ,(txt:'FOR NOW!';Col:colRed)
   ,(txt:'';Col:0) {8}
   ,(txt:'Thank you for playing Magic Maze.';Col:colBLue)
   ,(txt:'Hope you enjoyed it!';Col:colBlue)
   ,(txt:'If you did, please send me a small';Col:colGreen)
   ,(txt:'contribution, or tell me what you';Col:colGreen)
   ,(txt:'think of Magic Maze. See README.TXT';Col:colGreen)  {}
   ,(txt:'file for details!';Col:colGreen)
   ,(txt:'';Col:0)
   ,(txt:'..Good Bye..';Col:255)
   ,(txt:'';Col:0)
   ,(txt:'';Col:0)   {}
   ,(txt:'';Col:0)
   ,(txt:'WHAT''S THAT?!?';Col:colRed)
   ,(txt:'Did you expect to see a picture';Col:colGreen)
   ,(txt:'of the sexy, young virgin now?';Col:colGreen)
   ,(txt:'Preferably lightly dressed?';Col:colBlue)
   ,(txt:'Why you {}=>#%&!!!!';Col:colRed)
   ,(txt:'Do you want the world to think';Col:colBlue)
   ,(txt:'that all PC-freaks are drooling,';Col:colBlue)
   ,(txt:'girlie-picture-oogling no-brainers?';Col:colBlue)
   ,(txt:'NO WAY!';Col:colRed)    {}
   ,(txt:'';Col:0)
   ,(txt:'(To all that did NOT expect such a';Col:colGreen)
   ,(txt:'picture, pardon my outburst.)';Col:colGreen)
   ,(txt:'';Col:0)
   ,(txt:'Now, GOOD-GOOD BYE!!! :-)';Col:255)       {}
  );

VAR y:Integer;

  BEGIN

    FadeOut(10);
    LoadPCXPage2(GameName+'end.gra',pal2); {Load 1st end image (LUCIPER)}
    FOR i:=0 to 32 do
     BEGIN
      pal2[224-i]:=pal2[223+i];
     END;
    CopyFromPage2;

    s:='Good Bye!';
    x:=(160-(Length(s)*4));
    VGAColor:=230; FontWrite(x+1,2,s);
    VGAColor:=235; FontWrite(x,1,s);

    LastPress:=0; LastRelease:=0;
    FadeToPalette(pal2,0,223,30);
    FadeToPalette(pal2,223,255,10);
    for i:=1 to 191 DO pal2[i]:=pal2[255];
    i:=0;
    REPEAT
     SlidePalette(pal2,193,255);
     VSync;
     SetActivePalette(pal2,193,255);
     Inc(i); IF i>62 THEN i:=0;
    UNTIL (i=0) AND (LastPress IN[scSpace,scEsc,scQ]);
    FadeToPalette(pal2,1,191,50);
    for i:=1 to 191 DO pal2[i]:=pal2[0];
    PlaySnd(sndZAP);
    FadeToPalette(pal2,1,191,50);
    StartTimer;
    WaitFor(100);
    FadeToRGB(63,0,0,30);


    {* TEXT SCROLLER *}
    ClrVGAScr;
    VGAColor:=255;
    SetFontPage(1);
    FadeToPalette(pal,0,255,10);
    FOR y:=0 TO NumLines*16+100 DO
    BEGIN
     StartTimer;
     w:=y shr 4;
     {Scroll up, Y:51->Y50  -->  Y:150->Y:149}
     Vsync;
     asm
       push ds
       mov ax,$a000
       mov ds,ax
       mov bx,16000
       mov cx,16000
      @loop:
       mov ax,[bx+320]
       mov [bx],ax
       add bx,2
       loop @loop
       pop ds
     end;

     VGAColor:=0;
     HLine(0,150,319);
     IF w<=NumLines THEN
     BEGIN
       VGAColor:=Text[w].Col;
       x:=(150-(Length(Text[w].Txt) shl 2{*4}));
       b:=y and 15;
       FOR i:=1 TO Length(Text[w].Txt) DO
       BEGIN
         Inc(x,8);
         FontHline(x,150,Text[w].Txt[i],b);
       END;
     END;
     WaitFor(GameLoopDelay shr 1);

     IF Key[scEsc] THEN y:=NumLines shl 4+100;

    END;



    {LoadPCXPage2(GameName+'xend.gra',pal2); {Load second end image}
    {CopyFromPage2;
    LastPress:=0; LastRelease:=0;
    FadeToPalette(pal2,0,255,10);
    REPEAT  UNTIL LastPress IN[scSpace,scEsc,scQ];
    }

    FadeOut(20);
END;

PROCEDURE StartGame;
BEGIN
  FadeOut(10);
  LoadPCXPage2(GameName+'back.gra',pal2);
  IF Training THEN
  BEGIN
   SetFontPage(2); VGAColor:=0; FontWrite(240,182,'TRAINING!');

   VGAColor:=9; FontWrite(238,180,'TRAINING!'); SetFontPage(1);
  END;
  {Crash ETTER her ett sted: 215 p† 000:0562}
  CopyFromPage2;
  FadeToPalette(pal,0,255,10);
  StartTimer;
  CurrentSPell:=1;
  Current2ndSPell:=Min2ndSpellType;
  CurrentSpellChanged:=True;
  scoreBefore:=score+1;
  WaitFor(40);
  VGAColor:=9; FontWrite(238,180,'!test!'); SetFontPage(1);
  REPEAT
	Load_Set_Level;
   screenupdate(px,py);
   GameOver:=False; LevelExited:=False;
	DoGameLoop;
   IF LevelExited THEN Inc(Level);
  UNTIL Not(LevelExited) OR (Level>MaxLevels) OR (Training);
  If (Level>MaxLevels) AND (LevelExited) THEN PlayEndSequence;
END;

PROCEDURE NewGame;
BEGIN
  Level:=1;  {Start new game}
  Score:=0;
  Training:=False;
  StartGame;
END;

PROCEDURE RestoreGame;
BEGIN
 FadeOut(10);
 ClrVGAScr;
 LoadSaveGame;
  Level:=SaveLevel;
  Score:=SaveScore;
 Training:=False;
 StartGame;
END;

PROCEDURE SelectTrainingLevel;
CONST MaxEntries = 50; UpperX=132; UpperY=60;
VAR List:Array[1..MaxEntries] of String[3];
 k,i,j,Pos,TotalEntries:Integer;
BEGIN
 SetFontPage(1); VGAColor:=0; Box(UpperX,UpperY-16,UpperX+56,UpperY+80);
 VGAColor:=6; Rectangle(UpperX,UpperY,UpperX+56,UpperY+80);
 Rectangle(UpperX,UpperY-16,UpperX+56,UpperY);
 FontWrite(UpperX+8,UpperY-15,'LEVEL');
 VGAColor:=9; Box(UpperX, UpperY+2*16,UpperX+56, UpperY+2*16+15);
 i:=0;
 FindFirst(GameName+'map.*',Archive+ReadOnly, DirInfo);
 While (DosError=0) AND (i<MaxEntries) DO
 BEGIN
  Inc(i);
  j:=1;
  While (DirInfo.Name[j]<>'.') AND (j<12) Do Inc(j);
  WITH DirInfo DO List[i]:=Name[j+1]+Name[j+2]+Name[j+3];
  FindNext(DirInfo);
  {FOR j:=1 TO i-1 DO IF List[j]>List[j+1] THEN
    BEGIN s:=List[j]; List[j]:=List[j+1]; List[j+1]:=s; END}
 END;
 TotalEntries:=i;

 Pos:=1;
 REPEAT
  VSync;
  VGAColor:=0; Box(UpperX+16,UpperY+1,UpperX+40,UpperY+79);
  VGAColor:=9;
  FOR i:=0 TO 4 DO
  BEGIN
   j:=Pos+i-2;  IF i=2 THEN VGAColor:=10 ELSE VGAColor:=7;
   IF (j>0) AND (j<=TotalEntries) THEN FontWrite(UpperX+17,UpperY+i*16,List[j]);
  END;
  LastPress:=0;
  REPEAT k:=LastPress; UNTIL k<>0;
  CASE k OF
   scDown: IF (Pos<TotalEntries) THEN Inc(Pos);
   scUp:   IF (Pos>1) THEN Dec(Pos);
   scPgDn: IF (Pos+3<TotalEntries) THEN Inc(Pos,3);
   scUp:   IF (Pos-3>1) THEN Dec(Pos,3);
  END;
 UNTIL k IN[scSpace,scCtrl,scEnter,scQ,scEsc];

 IF K IN[scSpace,scCtrl,scEnter] THEN
 BEGIN
  LevelExtension:=List[Pos];
  Level:=0;
  Score:=0;
  Training:=True;
  StartGame;
 END;

END;


PROCEDURE TitleScreen;
CONST
 LeftX=80; RightX=80+8*20;
 UpperY=68; LowerY=71+4*16;
 MaxChoice = 3;
 TextList : Array[0..MaxChoice] of String[16] =
    ('New Game','Restore Game','Train Level','Quit');
VAR Choice,b : Byte; Pos:Integer; k:Word;
BEGIN
 REPEAT
  FadeOut(10);
  LoadPCXPage2(GameName+'title.gra',pal2); {Load titlescreen image}
  REPEAT
  SetFontPage(1);
  CopyFromPage2;
  LastPress:=0; LastRelease:=0;
  FadeToPalette(pal2,0,255,10);
  Choice:=0;
  REPEAT  Choice:=LastPress UNTIL Choice<>0;
  IF Not(Choice IN[scEsc,scQ]) THEN {Start screen menu}
  BEGIN
    VGAColor:=0; Box(LeftX,UpperY,RightX,LowerY);
    VGAColor:=7; Rectangle(LeftX,UpperY,RightX,LowerY);
    VGAColor:=9;
    FOR b:=0 TO 3 DO
      FontWrite((LeftX+RightX) div 2-Length(TextList[b])*4, UpperY+b*16+2, TextList[b]);
   REPEAT
    REPEAT UNTIL Not(Key[Choice]);
    Pos:=0;
    REPEAT
     VSync; VGAColor:=10; Rectangle(LeftX+2,UpperY+Pos*16+2,RightX-2,UpperY+Pos*16+17);
     LastPress:=0;
     REPEAT k:=LastPress; UNTIL k<>0;
     VSync; VGAColor:=0; Rectangle(LeftX+2,UpperY+Pos*16+2,RightX-2,UpperY+Pos*16+17);

     IF (k IN[scUp,scPgUp]) AND (Pos>0) THEN Dec(Pos);
     IF (k IN[scDown,scPgDn])  AND (Pos<MaxChoice) THEN Inc(Pos);
    UNTIL k IN[scSpace,scEsc,scQ,scCtrl,scEnter];

    IF k IN[scSpace,scCtrl,scEnter] THEN
    BEGIN
     CASE Pos OF
       0: NewGame;
       1: RestoreGame;
       2: SelectTrainingLevel;
       3:  Choice:=scEsc;
     END;
     Pos:=-1;
    END;

    UNTIL (k IN[scEsc,scQ]) OR (Pos=-1);
  END;

  {REPEAT  UNTIL LastPress IN[scSpace,scEsc,scQ];  {scF12}
  {Choice := LastPress;
  IF Choice=scSpace THEN StartNewGame;
  {DEBUG  IF (Choice=scF12) AND Key[scCtrl] THEN PlayEndSequence;  {}
 UNTIL (Choice IN[scEsc,scQ]) OR (Pos=-1);
 REPEAT UNTIL Not(key[scEsc]) AND Not(key[scQ]);
 UNTIL (Choice IN[scEsc,scQ]) AND (SureYN(80,52,'quit this game'));
 {Quit}

 FadeToRGB(60,60,60,10);     Vsync;
 ClrVGAScr;                  FadeOut(10);
END;

{*** MAIN PROGRAM BLOCK ***}
BEGIN
 Writeln;
 Writeln(' --++****************++--');
 Writeln(' --++** MAGIC MAZE **++--    Version 1.22');
 Writeln(' --++****************++--');
 Writeln('     Freeware Game');
 Writeln('Copyright (1995-96), remains with the creator.');
 Write(#10,' Created by the ... ');
 FOR i:=1 TO Length(NameOfCreatorBackup) DO Write(Chr(Ord(NameOfCreatorBackup[i]) shr 1));
 Writeln(' ...',#10);
 FOR i:=1 TO Length(NameOfCreatorBackup) DO    {Test name}
  IF (Ord(NameOfCreatorBackup[i]) shr 1)<>Ord(NameOfCreator[i])  THEN
  BEGIN
   Writeln('UH-OH, SOMEONE HAS BEEN MESSING AROUND WITH THIS PROGRAM!!!!');
   i:=Length(NameOfCreatorBackup);
  END;

 {Debuggin'}
 {Writeln('MemMax:',MaxAvail,'  MemA:',MemAvail); }
 SoundSetup:=-1;

 IF ParamCount>0 THEN
 FOR i:=1 TO ParamCount DO
 BEGIN
  s:=ParamStr(i);
  FOR j:=1 TO Length(s) DO s[j]:=UpCase(s[j]);
  IF (s='GUS') THEN SoundSetup:=GUSSound;
  IF (s='SB')  THEN SoundSetup:=SBSound;
  IF (s='NOSOUND') THEN SoundSetup:=NoSound;

  IF (s[1] IN['-','/','*']) THEN
  BEGIN

  END;

 END;

 IF SoundSetup<0 THEN
 BEGIN
  Writeln(#10,'Sound Effects selection.');
  Writeln('Enter:',#13,#10,' 1:- for Gravis UltraSound,');
  Writeln(' (( 2:- for SoundBlaster. DISABLED !!! )),');
  Writeln(' 0:- for No Sound (Silence)...');
  Readln(s);
  Val(s,SoundSetup,W);
 END;

 {** INITIALISATION **}
 Write  ('Allocating buffer...',#13);
 GetMem(MapBuf,(MapSize+MapHeaderSize+256));   {Get Buffer for map data}
 Writeln('MapBuffer allocated.');

 CASE SoundSetup OF
 GUSSound: {GUS!!!}
 BEGIN
   Write('Initiating GUS...',#13);
   l:=1024;
   GUSFind;
   GUSReset;
   FOR i:=1 TO 31 DO GUSVoiceControl(i,1);
   FOR i:=1 TO MaxSam DO
   BEGIN
	 Assign(fil,GameName+'sam.'+ExtNum(i));
	 Reset(fil,1);
    SamSize[i]:=FileSize(fil);
	 BLockRead(fil,MapBuf^,filesize(fil));
    Close(fil);
    gussam[i]:=l;
    FOR j:=1 TO SamSize[i] DO GusPoke(l+j-1,MapBuf^[j] XOR 127);
    l:=l+samSize[i]+8;
	END;
   FOR i:=1 TO 4 DO GUSSetBalance(i,7);
   SetGUSVol(47500);
   SoundOn:=True;
   Writeln('Gravis UltraSound initiated, and samples loaded.');
  END;
 SBSound: {If soundcard=SB}
 BEGIN
   Write('Initiating SB',#13);
	FOR i:=1 TO MaxSam DO
	BEGIN
	 Assign(fil,GameName+'sam.'+ExtNum(i));
	 Reset(fil,1);
	 SamSize[i]:=FIleSize(fil);
	 GetMem(sam[i],FileSize(fil));
	 BLockRead(fil,sam[i]^,filesize(fil));
    Close(fil);
	END;
	ResetSB; SoundOn:=True; SetSBVol(200);
   Writeln('SoundBlaster DISABLED due to problems with Win98!');{initiated, and samples loaded.'); }
 END;
 END;{CASE}

 Writeln('Entering 320x200x256 screen mode...');
 FadeOut(20);

 GoVGA256;            {Set up the screen, timer, and random number generator}
 InstallFastTimer;
 Randomize;
 FadeOut(10);
 GameLoopDelay :=DefaultGameLoopDelay;
 SystemFontInit;
 FontSpaced:=False; {Force char's from 9 to 8 pix width}
 InstallFastKeys;  {Set up the special keyboard handler }

 BEGIN
  {Sprite loader}
  Assign(fil,GameName+'spr.dat');
  Reset(fil,1);
  BlockRead(fil,pal,768); {Palette}
  FOR i:=0 TO MaxSpr DO
  BEGIN
    Writeln('Spr:',i);
 	 GetMem(Spr[i],SprBufSize);
    BlockRead(fil,Spr[i]^,SprBufSize);
  END;
  FOR i:=0 TO MaxBackSpr DO
  BEGIN
	 GetMem(BackSpr[i],SPrBufSize);
    BlockRead(fil,BackSpr[i]^,SprBufSize);
  END;
  Close(fil);
 END;


 TitleScreen; {START THE  GAME}

 {Reset the system}
 RestoreMode;    RestoreKeyboard;

 Writeln('Exiting game..');
 Writeln('Performance Rating in time/update:',Deb1,'ms '); {}
 Writeln;

 Writeln('Thank you for playing --++** MAGIC MAZE **++--');
 Writeln('You scored ',score,' points on the last game!!!');

 IF SOundSetup=GUSSound THEN
 BEGIN  FOR i:=1 TO 31 DO GUSVoiceControl(i,1);
  SetGUSVol(1000); {Silence GUS}
 END;
 {IF SoundSetup=2 THEN SetSBVol(SBMinVol);}
END.

{ DATA / INFORMATION
----------------------
 The MAPBUF (MM_MAP.??? file) contents syntax:

256 bytes - MapHeader:-
 (b.#0 <-> 11 = File format signature ='MagicMazeMap')
 (b.#12 -> 15 = $00 00 00 00, map format version)
   b.#16 -> 17 = Word sized checksum of main level data (Not header)
                [16]=chksum low byte  ,   [17]=chksum high byte
  b.#24 - Player start X coord
  b.#25 - player start Y coord
  b.#30 - Default Wall sprite if > 0. (The walltype surroundin' the maze)
  b.#32 - If bit(7)=1 then this is the last level
  b.#128->#166 - Level name
32768 Bytes (Byte #256 -> #33024) - Main Map Data
  0.byte -> A Byte.  Background/Wall texture
            Square can't be passed if Bit(7)=1
  1.byte -> B Byte.  Object/Monster/Door/Keys/Exit/Etc...

  A:=MapBuf^[ Y*256+X*2    + MapHeaderSize(256) ]
  B:=MapBuf^[ Y*256+X*2+1  + MapHeaderSize(256) ]

}
{ MM_SPR.DAT format
 768 bytes - Palette
 29 * 1030 - background sprites
 49 * 1030 - other sprites
}