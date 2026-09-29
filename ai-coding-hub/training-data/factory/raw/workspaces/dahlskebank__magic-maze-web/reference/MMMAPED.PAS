{MAGIC MAZE MAP EDITOR v0.262
Reads sprites from .DAT file, aimed at accompaning MM

Updates:
- LOAD MAP function boasts LIST SELECTOR
- 0?? range of ext's blocked from saving to prevent altered versions
+ Graphical Editor Save Function also blocks 0?? levels
+ MapExitsToHelpScreenIfUpArrowIsPressed-Bug eliminated.
+ MAP Movement, map draw slowdown bug removed....
}
{$G+} {286 instructions allowed}
PROGRAM Magic_Maze_Map_Editor;
USES FastVGA,PCXUnit,Crt,FastFonts,Dos;
CONST
 FreewareVersion = True;
 MapFileSignature: String = 'MagicMazeMap';
 dfPlayerStart = 24; dfLevelName = 128; dfLevelNameEnd = 166;
 colRed = 20;
colGreen = 30;
colBlue = 40;
 GameName = 'kd_game\mm_';
 cKeys = 30; {-32}
 cLockedDoor = 33; {-35}
 cExit = 39;  cChest=20; cLifePotion=21; cManaPotion=22;
 cMonsters = 40;
  MapSize = 32768;  MapHeaderSize = 256;
 SprMax = 59;  SprBufSIze = 1030;
 MaxSpr = 57; MaxBackSpr = 29;
 scEsc = #27;
 scUp = #72; scLeft = #75;
 scDown =#80 ; ScRight = #77;
 scReturn = #13;

TYPE MapType = Array[0..MapSize] of Byte;
 Extension = String[3];
VAR BackSpr,Spr : Array [0..SprMax] of Pointer;
 DirInfo:SearchRec;
 MapFileExt : Extension;
 s:string;
  pal:PaletteType;
 MapBuf : ^MapType;
 Fil:File;
 a,b,selection:Byte;
 x,y,i,PX,PY,PA,PB:Integer;
 l:LongInt;
 w,w2:Word;
 ch,ChS:Char;
 QuitLoop,bl,DefBlock:Boolean;

PROCEDURE GetKeyPress;
BEGIN
 ChS:=#00;
 Ch:=ReadKEy; IF Ch=#00 THEN ChS:=ReadKey;
 Ch:=UpCase(ch);
END;


Function SureYN(Str:String):Boolean;
VAR B:Boolean;
BEGIN
 VGAColor:=0;
 SetFontPage(1);
 Box(0,48,160,143);
 VGAColor:=8;
 FontWrite(4,50,'Do you want to');
 FOntWrite(8,66,Str);
 FontWrite(40,82,' ??? ');
 FontWrite(4,98,'([Y]es or [N]o?)');
 b:=False;
 REPEAT
  Ch:=UpCase(ReadKey);
  IF Ch='Y' THEN b:=True;
 UNTIL Ch IN['Y','N'];
 SureYN:=b;
END;

PROCEDURE ClearMap;
BEGIN
 FOR w:=0 TO (MapSize+MapHeaderSize) DO MapBuf^[w]:=0;
END;

{HELP SCREEN}
PROCEDURE ShowHelpScreen;
CONST Lines = 11;
 Text : ARRAY [1..Lines] of String[40]
  = ('Keys in editor:->',
  'Arrows move the cursor...',
  'SPACE :- Place OBJECT',
  'RETURN :- Place BACKGRND',
  'ESC :- Quit editing',
  '"+" and "-" :- Toggle BACKGRND',
  '"*" and "/" :- Toggle OBJECT',
  'S:- Save map   L:-Load map',
  'C:- Clear Square',
  'D:- Toggle default BLOCKED/NOT',
  'B:- Toggle square BLOCKED/NOT');
BEGIN

ClrVGAScr;
SetFOntPage(1);
VGAColor:=9;
FontWrite(0,0,'M.Maze MapEditor HELP!(Esc exits)');
Line(0,14,319,14);

VGAColor:=7;
FOR w:=1 TO Lines DO
 BEGIN
  FontWrite(0,w*15,Text[w]);
 END;
 Ch:=ReadKey;

END;



{ BITTEST(Byte,Digit) }
{ A Boolean function that tests a bit in a byte to see if it is set}
FUNCTION BitTest(b,d:Byte):Boolean;
CONST  bitset : ARRAY[0..7] of Byte = (1,2,4,8,16,32,64,128);
BEGIN
 IF (b AND bitset[d])=bitset[d] THEN BitTest:=TRUE ELSE BitTest:=FALSE;
END;


{MAP - x,y:Coord,  a,b,block:Returns data(wall,objects,blocked}
PROCEDURE Map(x,y:Integer; var a,b:Byte; var Block:Boolean);
VAR w:Word;
BEGIN
 IF (x>-1) AND (x<128) AND (y>-1) AND (y<128) THEN
	BEGIN
	 w:=y*256+x*2+MapHeaderSize;
	 a:=MapBuf^[w]; b:=MapBuf^[w+1];
	 IF BitTest(a,7) THEN Block:=True Else BLock:=False;
	 a:=a and 127;

	END
 ELSE
	BEGIN
	 a:=MapBuf^[30];  b:=0; BLock:=True; if a=0 THEN a:=10;
	END;
END;

PROCEDURE SetAMap(A:Byte; x,y:Byte);
BEGIN
 IF (x>=0) AND (x<128) AND (y>=0) AND (y<128) THEN
	 MapBuf^[y*256+x*2+MapHeaderSize]:=a;
END;

PROCEDURE SetBMap(b:Byte; x,y:Byte);
BEGIN
 IF (x>=0) AND (x<128) AND (y>=0) AND (y<128) THEN
	 MapBuf^[y*256+x*2+1+MapHeaderSize]:=b;
END;


PROCEDURE LoadLevel;   {Loads a level}
BEGIN
 CLearMap; {FOR w:=0 TO (MapSize+MapHeaderSize) DO MapBuf^[w]:=0; }
 Assign(Fil,GameName+'map.'+MapFileExt);
 Reset(fil,1);
 BlockRead(fil,MapBuf^,(MapSize+MapHeaderSize),w);
 Close(fil);
END;

PROCEDURE SaveLevel;   {Saves the level}
CONST
 Txt : Array[0..7] of String[80] =
  ('   -+* WARNING!! YOUR MAP WAS NOT SAVED!!! *+-',
   'As you are not supposed to distribute Magic Maze with altered',
   'versions of the original levels, you are prohibited to save',
   'your MAP in the MM_MAP.0?? range, as this range of extensions',
   'is reserved for the original Magic Maze levels.',
   'Refer to the documentation for more info...',
   '   Please select SAVE..AS at the menu, and enter an extension',
   'that does NOT begin with the character _0_(Zero).'
  );
BEGIN

IF FreewareVersion THEN
 IF MapFileExt[1]='0' THEN
 BEGIN
  ClrScr;
  FOR i:=0 TO 7 DO Writeln(Txt[i]);
  Writeln('   Press [Y] if you understand...');
  REPEAT GetKeyPress; UNTIL Ch='Y';
 END
 ELSE
 BEGIN
  {Add mapfile signature}
  FOr i:=0 TO 11 DO MapBuf^[i]:=Ord(MapFileSignature[i+1]);

  w:=0; { Add word sized checksum of main level data }
  FOR l:=MapHeaderSize TO MapSize+MapHeaderSize DO w:=w+MapBuf^[l];
  MapBuf^[16]:=w mod 256; MapBuf^[17]:=w div 256;




  Assign(Fil,GameName+'map.'+MapFileExt);
  Rewrite(fil,1);
  w:=MapSize+MapHeaderSize;
  REPEAT
   If MapBuf^[w]=0 THEN Dec(w);
  UNTIL MapBuf^[w]<>0;

  BlockWrite(fil,MapBuf^,(w+8));
  Close(fil);
 END;

END;


{Must be rewritten}
PROCEDURE ScreenUpdate;   {ScreenUpdate}
VAR x,y,xx,yy,xxx,yyy:Integer;
 a,b:Byte; bl:Boolean;
BEGIN
 VGAColor:=0;
 BoxPage2(0,0,319,199);
 VSync;

 FOR y:=-2 TO 2 DO
 FOR x:=-2 TO 2 DO
 BEGIN
   xx:=px+x;
   yy:=py+y;
	xxx:=64+x*32;
	yyy:=64+y*32;
	Map(xx,yy,a,b,bl);

	PutImagePage2(xxx,yyy,BackSpr[a]^,CopyPut);
	IF b>0 THEN PutImagePage2(xxx,yyy,Spr[b]^,TransPut);

   IF bl THEN VGAColor:=255 ELSE VGAColor:=0;
   BoxPage2(xxx+4,yyy+4,xxx+8,yyy+8);

   VGAColor:=255; CirclePage2(80,80,8);
 END;


 PutImagePage2(240,16,BackSpr[PA]^,CopyPut);
 PutImagePage2(280,16,Spr[PB]^,CopyPut);
 SetFontPage(2);
 VGAColor:=10;
 Str(Pa:2,s);
 s:='B:'+s;
 FontWrite(240,1,s);
 Str(Pb:2,s);
 s:='O:'+s;
 FontWrite(285,1,s);
 FontWrite(240,48,'Retn');
 FOntWrite(285,48,'Spce');
 {str(Pa:2,s);
 VGAColor:=0;
 FontWrite(242,16,s);
 VGAColor:=255;
 FontWrite(240,14,s);
 Str(pb:2,s);
 FontWrite(280,16,s);
 }
 IF DefBlock THEN FontWrite(0,163,'Def:BLOCK') ELSE FontWrite(0,163,'Def:NOT BL');

 Str(PX:3,S); FontWrite(170,65,'CXY:'+s); Str(PY:3,S); FontWrite(226,65,','+s);


 CopyBlockFromPage2(0,0,319,199);
 Vsync;
 {CopyBlockFromPage2(16,16,175,175); {Show playing grid}

END;

PROCEDURE MainLoop;
{CONST scEsc = #27;
scUp = #72; scLeft = #75;
scDown =#80 ; ScRight = #77;
scReturn = #13;}

 PROCEDURE MapPlot(x,y:Integer);
 VAR i:Byte;
 BEGIN
    Map(x,y,a,b,bl);
    i:=0;
    IF b>=cMOnsters THEN i:=colRed;
    IF bl THEN i:=255;
    VGAScreen[8+y][8+x]:=i;
 END;

CONST
 MapStep = 5;

BEGIN
 IF PX<0 THEN PX:=0 ELSE IF PX>127 THEN PX:=127;
 IF Py<0 THEN Py:=0 ELSE IF Py>127 THEN Py:=127;
 IF PA<0 THEN PA:=0 ELSE IF PA>SprMAx THEN Pa:=SprMax;
 IF Pb<0 THEN Pb:=0 ELSE IF Pb>SprMAx THEN Pb:=SprMax;





 ScreenUpdate;
 Map(px,py,a,b,bl);
 {ChS:=#00;
 Ch:=ReadKEy; IF Ch=#00 THEN ChS:=ReadKey;
 Ch:=UpCase(ch); }
 GetKeyPress;
 IF Ch=scEsc THEN IF SureYN('quit editor') THEN QuitLoop:=True;
 IF ChS=scUp THEN Dec(PY);
 IF ChS=scDown THEN Inc(PY);
 IF CHS=scLeft THEN Dec(PX);
 IF ChS=scRight THEn Inc(pX);
 IF Ch='M' THEN  {Game Map function}
  BEGIN
   VGAColor:=0; Box(0,0,160,160);
   FOR x:=-3 TO 130 DO FOR y:=-3 TO 130 DO MapPlot(x,y);
   {BEGIN
    Map(x,y,a,b,bl);
    i:=0;
    IF b>=cMOnsters THEN i:=colRed;
    IF bl THEN i:=255;


    VGAScreen[8+y][8+x]:=i;
   END;}
  REPEAT
   VGAColor:=colBlue; Box(px+7,py+7,px+9,py+9);
   GetKeyPress;
   VGAColor:=0; Box(px+7,py+7,px+9,py+9);
   FOR x:=px-1 TO px+1 DO FOR y:=py-1 TO py+1 DO MapPlot(x,y);
   CASE ChS OF
    scUp : IF py>MapStep THEN Dec(py,MapStep);
    scDown : IF py<127-MapStep THEN Inc(py,MapStep);
    scRight :IF px<127-MapStep THEN Inc(px,MapStep);
    scLeft : IF px>MapStep THEN Dec(px,MapStep);
   END;
  UNTIL Not(ChS IN[scUp,scDown,scRight,scLeft]);

   Ch:=#00; ChS:=#00;
  END;


 IF Ch='B' THEN
 BEGIN
  IF bl THEN SetAMap(a,px,py) ELSE
    SetAMap((a or 128),px,py);
 END;

 IF (Ch='+') and (PA<MaxBackSpr) THEN Inc(PA);
 IF (Ch='-') and (PA>0) THEN Dec(PA);
 IF (Ch='*') and (PB<MaxSpr) THEN Inc(PB);
 IF (CH='/') and (PB>0) THEN Dec(PB);

 IF Ch=' ' THEN  SetBMap(PB,PX,PY);
 IF Ch=scReturn THEN IF DefBlock THEN SetAMap( (PA OR 128),PX,PY) ELSE SetAMap(PA,PX,PY);

 IF CH='L' THEN IF SureYN('Load map '+MapFileExt) THEN LoadLevel;
 IF Ch='D' THEN DefBlock:=Not(DefBlock);
 IF Ch='C' THEN BEGIN SetAMap(0,PX,PY); SetBMap(0,PX,PY); END;
 IF (CH='S') AND (MapFileExt[1]<>'0')
    THEN IF SureYN('Save map '+MapFileExt) THEN SaveLevel;

 IF (Ch='H') OR (ChS=#59)THEN ShowHelpScreen;


END;

PROCEDURE SelectAndLoadMapFile;
CONST MaxEntries = 50; UpperY = 5;
VAR List:Array[1..MaxEntries] of Extension;
  TotalEntries:Integer;
  i,j:Integer;
BEGIN
 i:=0;
 FindFirst(GameName+'map.*',Archive+ReadOnly, DirInfo);
 While (DosError=0) AND (i<MaxEntries) DO
 BEGIN
  Inc(i);
  j:=1;
  While (DirInfo.Name[j]<>'.') AND (j<12) Do Inc(j);
  WITH DirInfo DO List[i]:=Name[j+1]+Name[j+2]+Name[j+3];
  FindNext(DirInfo);
 END;
 TotalEntries:=i;
 i:=1;
 ClrScr;
 REPEAT
  GotoXY(1,UpperY);
  Writeln(' Select a MM_MAP file');
  Writeln('----------------------');
  FOR j:=-2 TO 2 DO
  BEGIN
   ClrEol;
   IF j=0 THEN Write('-+*> ') ELSE Write('     ');
   IF (i+j>0) AND (i+j<=TotalEntries) THEN Writeln(List[i+j]) ELSE Writeln;
  END;
  GetKeyPress;
  IF (ChS=ScUp) AND (i>1) THEN Dec(i);
  IF (ChS=ScDown) AND (i<TotalEntries) THEN Inc(i);
 UNTIL (Ch IN[scEsc,'Q',' ',scReturn]);

 IF (Ch IN[' ',scReturn]) THEN
 BEGIN
  MapFileExt:=List[i];
  Write('Are you sure you want to load level(Y/N)? ');
  Ch:=UpCase(ReadKey);
  IF Ch='Y' THEN
  BEGIN
    Write('Loading level..',#13);
    LoadLevel;
    Writeln(' Level has been loaded!');
  END;
 END;
END;

BEGIN

 {Initialisation}
 GoVGA256;

   {Sprite loader}
  Assign(fil,GameName+'spr.dat');
  Reset(fil,1);
  BlockRead(fil,pal,768); {Palette}
  FOR i:=0 TO MaxSpr DO
  BEGIN
 	 GetMem(Spr[i],SprBufSize);
    BlockRead(fil,Spr[i]^,SprBufSize);
  END;
  FOR i:=0 TO MaxBackSpr DO
  BEGIN
	 GetMem(BackSpr[i],SPrBufSize);
    BlockRead(fil,BackSpr[i]^,SprBufSize);
  END;
  Close(fil);

 {LoadPCXPage2(GameName+'sspr.pcx',pal);     {Load special sprites}
 {FOR i:=0 TO 59 DO  {Skal v‘re 59}
 {BEGIN
	GetMem(Spr[i],SprBufSize);
	x:=(i MOD 10)*32;
	y:=Trunc(i/10)*32;
	GetImagePage2(x,y,x+31,y+31,Spr[i]^);
 END;

 LoadPCXPage2(GameName+'bspr.pcx',pal);     {Load wall/floor sprites}
 {FOR i:=0 TO 59 DO   {Skal v‘re 59}
 {BEGIN
	GetMem(BackSpr[i],SPrBufSize);
	x:=(i MOD 10)*32;
	y:=Trunc(i/10)*32;
	GetImagePage2(x,y,x+31,y+31,BackSpr[i]^);
 END;
 }

 RestoreMode;

 GetMem(MapBuf,MapSize+MapHeaderSize);   {Get Buffer for map data}

 s:=ParamStr(1);
 IF s[1]='.' THEN MapFileExt := s[2]+s[3]+s[4] ELSE MapFileExt:='XXX';
 ClearMap;

 REPEAT
  CLrScr;
  Writeln('  -+*  MAGIC MAZE MAP EDITOR v0.262 *+-');
  Writeln('    By  MenThal  ..[alias Kent Dahl]..',#10);
  Writeln('File: MM_MAP.',MapFileExt,'   Start coord:',MapBuf^[dfPlayerStart]:3,',',MapBuf^[dfPlayerStart+1]:3);
  Writeln('Default wall is nr.:',MapBuf^[30]);
  Write('Level name:');
  FOR i:=dfLevelName TO dfLevelNameEnd DO Write(chr(MapBuf^[i]));  Writeln;

  Writeln(#10,'Select an option:');
  Writeln('  1: EDIT current map.');
  Writeln('  2: LOAD a MM_MAP file.');
  Writeln('  3: Save MM_MAP.',MapFileExt);
  Writeln('  4: SAVE new map AS....');
  Writeln('  5: Edit player start coordinates');
  Writeln('  6: Edit Level Name');
  Writeln('  7: New default wall');
  Writeln('  8: Clear Map');
  Writeln('  0: Quit program.');


  REPEAT Ch:=ReadKey; b:=Ord(Ch)-Ord('0'); UNTIL (b>=0) AND (b<10);
  selection:=b;

  CASE selection OF
   1:BEGIN  {Edit Map (Grapical)}
      GoVGA256;
      SystemFontInit;
      FOntSpaced :=False;
      FadeToPalette(pal,0,255,10);
      PX:=MapBuf^[dfPlayerStart]; PY:=MapBuf^[dfPlayerStart+1];
      PA:=0; PB:=cChest;
      QuitLoop:=False;
      REPEAT
       MainLoop;
      UNTIL QuitLoop;
      RestoreMode;
     END;
   2:SelectAndLoadMapFile;
   3:BEGIN
      Write('Are you sure you want to save level(Y/N)? ');
      Ch:=UpCase(ReadKey);
      IF Ch='Y' THEN
      BEGIN
       Write('Saving level..',#13);
       SaveLevel;
       Writeln(' Level has been saved!');
      END;
     END;
   4:BEGIN {Save as...}
      Writeln(chr(10),'Enter extension (3 letters) of new map file:');
      Writeln(' (First letter can''t be 0 (Zero))');
      Write(' MM_MAP.*> ');
      Readln(s);
      FindFirst(GameName+'map.'+s,Archive+ReadOnly, DirInfo);
      Ch:=#00;
      IF (DosError=0) THEN
      BEGIN
       Write('Existing file. Do you want to save over MM_MAP.',s,' (Y/N)? ');
       Ch:=UpCase(ReadKey);
      END;
      IF (Ch='Y') OR (DosError<>0) THEN
      BEGIN
        MapFileExt:=s;
        Write('Saving level MM_MAP.',MapFileExt,#13);
        SaveLevel;
        Writeln(' Level has been saved!');
      END;
     END;
   5:BEGIN {New start coords}
      Write('Enter player start X coordinate(0-127):');
      REPEAT Readln(b) UNTIL (b>=0) AND (B<128);
      MapBuf^[dfPlayerStart]:=b;
      Write('Enter player start Y coordinate(0-127):');
      REPEAT Readln(b) UNTIL (b>=0) AND (B<128);
      MapBuf^[dfPlayerStart+1]:=b;
     END;
   6:BEGIN {Edit Level Name}
      Writeln('Enter new level name(Max 38 chars):');
      Readln(s);
      FOR i:=128 to 166 DO MapBuf^[i]:=0;
      FOR i:=1 TO Length(s) DO MapBuf^[i+127]:=Ord(s[i]);
     END;
   7:BEGIN {New default wall}
      Write('Enter sprite number of wanted default wall(0-59):');
      REPEAT Readln(b); UNTIL (b>=0) and (b<60);
      MapBuf^[30]:=b;
     END;
   8:BEGIN
      Write('Are you sure you want to clear the map(Y/N)? ');
      Ch:=UpCase(ReadKey);
      IF Ch='Y' THEN CLearMap;
     END;
   END;

 UNTIL (selection=0);

END.

{ DATA / INFORMATION
----------------------
 The MAPBUF (MM_MAP.??? file) contents syntax:

256 bytes - MapHeader:-
  b.#0 <-> 11 = File format signature ='MagicMazeMap'
 (b.#12 -> 15 = $00 00 00 00, map format version)
  b.#16 -> 17 = Word sized checksum of main level data (Not header)
                [16]=chksum mod 256  ,   [17]=chksum div 256
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
{
CONST MaxEntries = 50;
VAR List:Array[1..MaxEntries] of String[3];
  TotalEntries:Integer; DirInfo:SearchRec;
BEGIN
 i:=0;
 FindFirst(GameName+'map.*',Archive+ReadOnly, DirInfo);
 While (DosError=0) AND (i<MaxEntries) DO
 BEGIN
  Inc(i);
  j:=1;
  While (DirInfo.Name[j]<>'.') AND (j<12) Do Inc(j);
  WITH DirInfo DO List[i]:=Name[j+1]+Name[j+2]+Name[j+3];
  FindNext(DirInfo);
 END;
 TotalEntries:=i;
}