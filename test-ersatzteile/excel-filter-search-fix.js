(()=>{
  function applySearchSelection(input){
    const menu=input.closest('#columnFilterMenu');
    if(!menu)return;
    const q=String(input.value||'').trim().toLocaleLowerCase('de');
    if(!q)return;
    const choices=[...menu.querySelectorAll('#columnValueList .filterChoice')];
    choices.forEach(choice=>{
      const cb=choice.querySelector('input[type="checkbox"]');
      if(!cb)return;
      const text=String(choice.dataset.choiceText||'').toLocaleLowerCase('de');
      cb.checked=text.includes(q);
    });
    const visible=choices.filter(choice=>choice.style.display!=='none').map(choice=>choice.querySelector('input[type="checkbox"]')).filter(Boolean);
    const all=menu.querySelector('#columnSelectAll');
    if(all){
      all.checked=visible.length>0&&visible.every(cb=>cb.checked);
      all.indeterminate=visible.some(cb=>cb.checked)&&!all.checked;
    }
  }

  document.addEventListener('input',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='columnValueSearch')return;
    queueMicrotask(()=>applySearchSelection(input));
  });

  document.addEventListener('keydown',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='columnValueSearch'||event.key!=='Enter')return;
    event.preventDefault();
    applySearchSelection(input);
    input.closest('#columnFilterMenu')?.querySelector('[data-filter-ok]')?.click();
  });
})();
