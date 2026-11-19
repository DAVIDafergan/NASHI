// Story card (1080x1920) – the box on stone, ready for Instagram/WhatsApp status
window.rbCard=async function({boxNo,ref,streak,first}){
  const c=document.createElement('canvas');c.width=1080;c.height=1920;const x=c.getContext('2d');
  const load=s=>new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src=s});
  try{await document.fonts.load('600 60px Fredoka');await document.fonts.load('700 120px Fredoka')}catch{}
  const [st,bx,lg]=await Promise.all([load('/stone.jpg'),load('/box.png'),load('/logo-900.png')]);
  if(st){x.fillStyle=x.createPattern(st,'repeat');x.fillRect(0,0,1080,1920)}else{x.fillStyle='#0e1430';x.fillRect(0,0,1080,1920)}
  const v=x.createRadialGradient(540,900,200,540,900,1200);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.55)');x.fillStyle=v;x.fillRect(0,0,1080,1920);
  x.strokeStyle='rgba(212,176,106,.75)';x.lineWidth=3;x.strokeRect(46,46,988,1828);x.strokeStyle='rgba(212,176,106,.3)';x.lineWidth=1.5;x.strokeRect(62,62,956,1796);
  x.textAlign='center';x.direction='rtl';
  x.fillStyle='#cfc6b3';x.font='500 44px Fredoka, sans-serif';x.fillText(streak>1?`${first?first+' · ':''}${streak} בקרים ברצף`:(first?first+' לקח/ה על עצמו/ה':'לקחתי על עצמי'),540,190);
  const gg=x.createLinearGradient(0,230,0,400);gg.addColorStop(0,'#ecd08f');gg.addColorStop(1,'#b8904a');x.fillStyle=gg;x.font='700 116px Fredoka, sans-serif';x.fillText('שקל ביום לרבינו',540,340);
  if(bx){const sh=x.createRadialGradient(540,1440,10,540,1440,380);sh.addColorStop(0,'rgba(0,0,0,.6)');sh.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=sh;x.beginPath();x.ellipse(540,1440,380,70,0,0,7);x.fill();const w=760,h=w*bx.height/bx.width;x.drawImage(bx,540-w/2,430,w,h)}
  x.fillStyle='rgba(14,20,48,.85)';const tw=520;x.beginPath();x.roundRect(540-tw/2,1520,tw,96,48);x.fill();x.strokeStyle='#d4b06a';x.lineWidth=2.5;x.stroke();
  x.fillStyle='#ecd08f';x.font='600 54px Fredoka, sans-serif';x.fillText('קופה מס׳ '+String(boxNo).padStart(4,'0'),540,1585);
  x.fillStyle='#d4b06a';x.font='500 36px Fredoka, sans-serif';x.fillText('נ נח נחמ נחמן מאומן',540,1720);
  x.fillStyle='#9a937f';x.font='500 32px Fredoka, sans-serif';x.fillText(location.host+'/r/'+ref,540,1790);
  return new Promise(ok=>c.toBlob(ok,'image/png'))};
window.rbShare=async function(o,text){const blob=await rbCard(o);const f=new File([blob],'rabeinu-sheli.png',{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],text});return}catch(e){if(e.name==='AbortError')return}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rabeinu-sheli.png';a.click();setTimeout(()=>open('https://wa.me/?text='+encodeURIComponent(text),'_blank'),500)};
