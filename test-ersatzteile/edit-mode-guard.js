(()=>{
  const PASSWORD='demo';
  const editToggle=document.getElementById('editToggle');
  if(!editToggle)return;
  const editBanner=document.getElementById('editBanner');
  const originalToggle=editToggle.onclick;

  function makeModal(id,title,body,actions=''){
    const wrap=document.createElement('div');
    wrap.id=id;wrap.className='editGuardModal';
    wrap.innerHTML=`<div class="editGuardCard" role="dialog" aria-modal="true" aria-labelledby="${id}-title"><div class="editGuardHead"><h2 id="${id}-title">${title}</h2></div><div class="editGuardBody">${body}</div><div class="editGuardActions">${actions||'<button type="button" class="editGuardBtn primary" data-close>Schließen</button>'}</div></div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-close]'))closeModal(wrap)});
    return wrap;
  }
  function openModal(el){el.classList.add('open')}
  function closeModal(el){el.classList.remove('open')}

  const passModal=makeModal('editPasswordModal','Bearbeitungsmodus entsperren',`
    <p style="margin:0;color:#657687;font-size:12px;line-height:1.5">Demo-Ersatzteile werden nur im Browser geändert. Bei selbst importierten Excel-Dateien kann direkt in die Quelldatei gespeichert werden.</p>
    <label class="editGuardField"><span>Passwort</span><input id="editPasswordInput" class="editGuardInput" type="password" autocomplete="off" placeholder="Passwort eingeben"></label>
    <div class="editGuardHint">Hinweis: Demo-Passwort: demo.</div>
    <div class="editGuardError" id="editPasswordError"></div>
  `,'<button type="button" class="editGuardBtn" data-close>Abbrechen</button><button type="button" class="editGuardBtn primary" id="editPasswordSubmit">Entsperren</button>');
  const passInput=passModal.querySelector('#editPasswordInput');
  const passError=passModal.querySelector('#editPasswordError');
  const passSubmit=passModal.querySelector('#editPasswordSubmit');

  const infoModal=makeModal('editOverviewModal','Übersicht Bearbeitungsmodus',`
    <div class="editOverviewGrid">
      <div class="editOverviewItem"><strong>Was kann der Bearbeitungsmodus?</strong><span>Ersatzteile können direkt aus der Zentralen Liste heraus bearbeitet werden. Bei .xlsx/.xlsm werden die Änderungen in die jeweilige Quelldatei zurückgeschrieben.</span></div>
      <div class="editOverviewItem"><strong>Was bleibt geschützt?</strong><span>Vor dem Speichern wird geprüft, ob die Quelldatei seit dem Einlesen extern verändert wurde. Bei einer Änderung wird das Überschreiben blockiert.</span></div>
      <div class="editOverviewItem"><strong>Voraussetzung</strong><span>Die Beispielteile funktionieren direkt im Browser. Für das Zurückschreiben eigener Excel-Dateien sind Chrome oder Edge und eine Dateifreigabe erforderlich.</span></div>
      <div class="editOverviewItem"><strong>Wann wird das Passwort abgefragt?</strong><span>Jedes Mal, wenn der Bearbeitungsmodus neu aktiviert wird. Ausschalten funktioniert ohne Passwort.</span></div>
    </div>
    <div class="editOverviewPassword">Hinweis zum Passwort: Demo-Passwort: demo.</div>
  `);

  const infoBtn=document.createElement('button');
  infoBtn.type='button';infoBtn.className='btn secondary editInfoBtn';infoBtn.textContent='Info Bearbeitungsmodus';
  infoBtn.onclick=()=>openModal(infoModal);
  editToggle.parentElement?.insertBefore(infoBtn,editToggle);

  function activate(){
    if(typeof originalToggle==='function')originalToggle.call(editToggle,new Event('click'));
    else editToggle.click();
  }
  function tryUnlock(){
    const value=(passInput.value||'').trim().toLowerCase();
    if(value!==PASSWORD){passError.textContent='Passwort nicht korrekt.';passInput.select();return}
    passError.textContent='';passInput.value='';closeModal(passModal);activate();
  }
  passSubmit.onclick=tryUnlock;
  passInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();tryUnlock()}if(e.key==='Escape')closeModal(passModal)});

  editToggle.onclick=e=>{
    const active=!!editBanner?.classList.contains('show');
    if(active){if(typeof originalToggle==='function')originalToggle.call(editToggle,e);return}
    passError.textContent='';passInput.value='';openModal(passModal);setTimeout(()=>passInput.focus(),0);
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal(passModal);closeModal(infoModal)}});
})();
