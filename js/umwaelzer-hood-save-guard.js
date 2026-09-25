(()=>{
  const TEMP_KEY='hoodSocketGuard';

  // Das Schutzhauben-Formular trägt dieselbe data-hood-socket-Kennung wie
  // die anklickbaren Tabellenzeilen. Während eines Klicks im Formular wird
  // die Kennung deshalb kurz entfernt, damit der Zeilen-Handler den Klick
  // nicht als "Schutzhaube öffnen" abfängt.
  document.addEventListener('click',event=>{
    const form=event.target?.closest?.('#hoodRepairForm');
    if(!form)return;

    if(form.hasAttribute('data-hood-socket')){
      form.dataset[TEMP_KEY]=form.getAttribute('data-hood-socket')||'';
      form.removeAttribute('data-hood-socket');
    }

    // Beim Submit wird die Kennung im submit-Event vor dem eigentlichen
    // Speichern wiederhergestellt. Bei allen anderen Klicks direkt danach.
    if(!event.target.closest('button[type="submit"]')){
      setTimeout(()=>{
        if(form.isConnected&&!form.hasAttribute('data-hood-socket')){
          form.setAttribute('data-hood-socket',form.dataset[TEMP_KEY]||'');
        }
      },0);
    }
  },true);

  document.addEventListener('submit',event=>{
    const form=event.target?.closest?.('#hoodRepairForm');
    if(!form)return;
    if(!form.hasAttribute('data-hood-socket')){
      form.setAttribute('data-hood-socket',form.dataset[TEMP_KEY]||'');
    }
  },true);
})();
