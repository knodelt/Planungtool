(()=>{
  const STORAGE_KEY='planungtool_demo_ersatzteile_column_widths_v1';
  const MIN_WIDTH=64;
  const MAX_WIDTH=560;

  function clamp(v){return Math.max(MIN_WIDTH,Math.min(MAX_WIDTH,Math.round(v)))}
  function loadWidths(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{}}catch{return{}}}
  function saveWidths(widths){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(widths))}catch{}}

  function init(){
    const table=document.querySelector('.tableWrap table');
    if(!table||table.dataset.resizeReady==='1')return;
    const headRow=table.tHead?.rows?.[0];
    if(!headRow)return;
    const headers=[...headRow.cells];
    if(!headers.length)return;

    table.dataset.resizeReady='1';
    table.classList.add('resizableColumns');

    let colgroup=table.querySelector('colgroup[data-resize-cols]');
    if(!colgroup){
      colgroup=document.createElement('colgroup');
      colgroup.dataset.resizeCols='1';
      headers.forEach(()=>colgroup.appendChild(document.createElement('col')));
      table.insertBefore(colgroup,table.firstChild);
    }
    const cols=[...colgroup.children];
    const stored=loadWidths();
    const widths={};

    headers.forEach((th,i)=>{
      const measured=th.getBoundingClientRect().width||110;
      const width=clamp(stored[i]||measured);
      widths[i]=width;
      cols[i].style.width=`${width}px`;
      th.style.width=`${width}px`;
      th.style.minWidth=`${width}px`;
      th.style.maxWidth=`${width}px`;

      const handle=document.createElement('span');
      handle.className='columnResizeHandle';
      handle.title='Ziehen: Spaltenbreite ändern · Doppelklick: automatisch anpassen';
      handle.setAttribute('aria-hidden','true');
      th.appendChild(handle);

      let startX=0,startWidth=0,pointerId=null;
      const apply=(w)=>{
        const next=clamp(w);
        widths[i]=next;
        cols[i].style.width=`${next}px`;
        th.style.width=`${next}px`;
        th.style.minWidth=`${next}px`;
        th.style.maxWidth=`${next}px`;
      };

      handle.addEventListener('pointerdown',e=>{
        e.preventDefault();e.stopPropagation();
        pointerId=e.pointerId;startX=e.clientX;startWidth=widths[i];
        handle.classList.add('active');table.classList.add('resizingColumns');
        handle.setPointerCapture?.(e.pointerId);
      });
      handle.addEventListener('pointermove',e=>{
        if(pointerId!==e.pointerId)return;
        apply(startWidth+(e.clientX-startX));
      });
      const finish=e=>{
        if(pointerId===null||(e.pointerId!==undefined&&pointerId!==e.pointerId))return;
        pointerId=null;handle.classList.remove('active');table.classList.remove('resizingColumns');saveWidths(widths);
      };
      handle.addEventListener('pointerup',finish);
      handle.addEventListener('pointercancel',finish);

      handle.addEventListener('dblclick',e=>{
        e.preventDefault();e.stopPropagation();
        let best=th.scrollWidth+18;
        const body=table.tBodies?.[0];
        if(body){
          const rows=body.rows;
          for(let r=0;r<rows.length;r++){
            const cell=rows[r].cells[i];
            if(cell)best=Math.max(best,cell.scrollWidth+18);
          }
        }
        apply(best);saveWidths(widths);
      });
    });

    const updateTableWidth=()=>{
      const total=Object.values(widths).reduce((a,b)=>a+b,0);
      table.style.width=`${Math.max(total,table.parentElement?.clientWidth||0)}px`;
    };
    updateTableWidth();

    const observer=new MutationObserver(updateTableWidth);
    observer.observe(table.tBodies[0],{childList:true,subtree:true});
    window.addEventListener('resize',updateTableWidth,{passive:true});

    headers.forEach((th,i)=>{
      const handle=th.querySelector('.columnResizeHandle');
      if(!handle)return;
      handle.addEventListener('pointermove',()=>requestAnimationFrame(updateTableWidth));
      handle.addEventListener('dblclick',()=>requestAnimationFrame(updateTableWidth));
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
  else setTimeout(init,0);
})();
