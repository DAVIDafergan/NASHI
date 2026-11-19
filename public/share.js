// Story card 1080x1920 – Bona Nova headline, the box, personal number + QR to join
window.rbCard=async function({boxNo,ref,streak,first}){
  const W=1080,H=1920,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const load=s=>new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src=s});
  try{await Promise.all([document.fonts.load('200 120px Heebo'),document.fonts.load('800 120px Heebo'),document.fonts.load('700 120px "Bona Nova"'),document.fonts.load('500 40px Fredoka'),document.fonts.load('600 40px Fredoka')])}catch{}
  const link=location.origin+'/r/'+ref;
  const [st,bx,qr]=await Promise.all([load('/stone.jpg'),load('/box.png'),load('/api/qr?c=141c4a&d='+encodeURIComponent(link))]);
  x.fillStyle=st?x.createPattern(st,'repeat'):'#0e1430';x.fillRect(0,0,W,H);
  let g=x.createRadialGradient(540,980,120,540,980,1250);g.addColorStop(0,'rgba(217,174,91,.10)');g.addColorStop(.45,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.6)');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(212,176,106,.55)';x.lineWidth=2;x.strokeRect(40,40,W-80,H-80);
  // arch behind the box (the tziyun)
  const arch=(w,top,bot,lw,a)=>{x.beginPath();x.moveTo(540-w/2,bot);x.lineTo(540-w/2,top+w/2);x.arc(540,top+w/2,w/2,Math.PI,0);x.lineTo(540+w/2,bot);x.strokeStyle=`rgba(212,176,106,${a})`;x.lineWidth=lw;x.stroke()};
  arch(780,560,1470,2.5,.55);arch(740,600,1470,1,.3);
  x.textAlign='center';x.direction='rtl';
  x.fillStyle='#d4b06a';x.font='500 30px Fredoka, sans-serif';x.letterSpacing='10px';x.fillText('נ נח נחמ נחמן מאומן',540,130);x.letterSpacing='0px';
  x.fillStyle='#f3ead7';x.font='200 124px Heebo, sans-serif';x.fillText('שקל אחד ביום',540,300);
  g=x.createLinearGradient(0,330,0,470);g.addColorStop(0,'#f1d697');g.addColorStop(.55,'#d2ab62');g.addColorStop(1,'#a97f39');x.fillStyle=g;x.font='800 188px Heebo, sans-serif';x.fillText('לרבינו',540,462);
  if(bx){const sh=x.createRadialGradient(540,1435,10,540,1435,330);sh.addColorStop(0,'rgba(0,0,0,.7)');sh.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=sh;x.beginPath();x.ellipse(540,1435,330,60,0,0,7);x.fill();const w=720,h=w*bx.height/bx.width;x.drawImage(bx,540-w/2,1450-h,w,h)}
  g=x.createLinearGradient(0,1500,0,1580);g.addColorStop(0,'#f1d697');g.addColorStop(1,'#b98d43');x.fillStyle=g;x.font='200 70px Heebo, sans-serif';x.fillText((first?first+' · ':'')+'קופה מס׳ '+String(boxNo).padStart(4,'0'),540,1565);
  x.fillStyle='#cfc6b3';x.font='500 36px Fredoka, sans-serif';x.fillText(streak>1?`${streak} בקרים ברצף · בזכותי עוד יהודי באומן`:'לקחתי על עצמי – בזכותי עוד יהודי באומן',540,1625);
  // bottom: QR + call to action
  const qx=130,qy=1680,qs=170;x.fillStyle='#e6d3a6';x.beginPath();x.roundRect(qx,qy,qs,qs,18);x.fill();if(qr)x.drawImage(qr,qx+14,qy+14,qs-28,qs-28);
  x.textAlign='right';x.fillStyle='#f3ead7';x.font='200 56px Heebo, sans-serif';x.fillText('רוצים קופה משלכם?',950,1740);
  x.fillStyle='#d4b06a';x.font='600 34px Fredoka, sans-serif';x.fillText('סרקו את הקוד · שקל אחד ביום',950,1792);
  x.fillStyle='#8f8878';x.font='500 26px Fredoka, sans-serif';x.fillText(location.host+'/r/'+ref,950,1836);
  return new Promise(ok=>c.toBlob(ok,'image/png'))};
window.rbShare=async function(o,text){const blob=await rbCard(o);const f=new File([blob],'rabeinu-sheli.png',{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],text});return}catch(e){if(e.name==='AbortError')return}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rabeinu-sheli.png';a.click();setTimeout(()=>open('https://wa.me/?text='+encodeURIComponent(text),'_blank'),500)};
