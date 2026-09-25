const style=document.createElement('style');
style.textContent=`
#archiveFullPreviewModal{padding:8px!important;overflow:hidden!important;align-items:center!important;justify-content:center!important}
.archive-full-modal{width:calc(100vw - 16px)!important;height:calc(100dvh - 16px)!important;max-width:none!important;max-height:none!important;margin:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
.archive-full-modal .modal-head{flex:0 0 auto!important}
.archive-full-body{display:flex!important;flex:1!important;min-height:0!important;overflow:hidden!important;background:#e9eef2!important}
.archive-full-stage{width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important;display:block!important}
.archive-full-frame{display:block!important;width:100%!important;height:100%!important;min-height:0!important;border:0!important;background:#fff!important}
.archive-full-image{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important}
@media(max-width:850px){
  #archiveFullPreviewModal{padding:4px!important}
  .archive-full-modal{width:calc(100vw - 8px)!important;height:calc(100dvh - 8px)!important}
}
`;
document.head.appendChild(style);

function fitFullPreview(){
  const frame=document.querySelector('#archiveFullPreviewStage .archive-full-frame');
  if(!frame)return;
  const src=frame.getAttribute('src')||'';
  if(!src||src.includes('zoom=page-fit'))return;
  const base=src.split('#')[0];
  frame.setAttribute('src',`${base}#page=1&zoom=page-fit&toolbar=1&navpanes=0`);
}

const stage=document.querySelector('#archiveFullPreviewStage');
if(stage){
  new MutationObserver(fitFullPreview).observe(stage,{childList:true,subtree:true});
  fitFullPreview();
}
