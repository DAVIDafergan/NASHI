// rounded vertical corners for every .kb box: 4 corners × 6 thin strips around a cylinder of radius --r
(function(){
  const N=8,B=[[0,1],[22,1.42],[40,1.05],[90,.78],[180,.7],[270,.6],[330,.9],[345,1.12],[360,1]]; // a soft specular highlight on the front-right corner
  const lum=a=>{for(let i=1;i<B.length;i++)if(a<=B[i][0]){const[a0,b0]=B[i-1],[a1,b1]=B[i];return b0+(b1-b0)*(a-a0)/(a1-a0)}return 1};
  const C=[[1,1,0],[1,-1,90],[-1,-1,180],[-1,1,270]]; // x sign, z sign, start angle
  function build(kb){if(kb.dataset.round)return;kb.dataset.round=1;const frag=document.createDocumentFragment();
    for(const[sx,sz,a0]of C)for(let k=0;k<N;k++){const a=a0+(k+.5)*90/N,el=document.createElement('div');el.className='cs';
      el.style.width=`calc(2*var(--r)*${Math.sin(Math.PI/4/N).toFixed(4)} + 0.6px)`;el.style.left=`calc((var(--w) - 2*var(--r)*${Math.sin(Math.PI/4/N).toFixed(4)})/2)`;
      el.style.transform=`translateX(calc(${sx}*(var(--w)/2 - var(--r)))) translateZ(calc(${sz}*(var(--d)/2 - var(--r)))) rotateY(${a}deg) translateZ(var(--r))`;
      el.style.filter=`brightness(${lum(a).toFixed(3)})`;frag.appendChild(el)}
    kb.appendChild(frag)}
  const run=()=>document.querySelectorAll('.kb').forEach(build);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
  window.kbRound=run;
})();
