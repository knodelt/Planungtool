(()=>{
  const input=document.getElementById('search');
  const fileFilter=document.getElementById('fileFilter');
  const tableHead=document.querySelector('.tableHead');
  if(!input||!fileFilter||!tableHead||document.querySelector('.tableHeadControls'))return;

  const controls=document.createElement('div');
  controls.className='tableHeadControls';

  const searchWrap=document.createElement('div');
  searchWrap.className='tableHeadGlobalSearch';
  input.placeholder='Alle Felder durchsuchen …';
  input.setAttribute('aria-label','Alle Felder durchsuchen');
  input.classList.add('tableHeadSearchInput');
  searchWrap.appendChild(input);

  const fileWrap=document.createElement('div');
  fileWrap.className='tableHeadFileFilter';
  fileFilter.setAttribute('aria-label','Quelldatei filtern');
  fileFilter.classList.add('tableHeadFileSelect');
  fileWrap.appendChild(fileFilter);

  controls.append(searchWrap,fileWrap);

  const sourceStatus=document.getElementById('sourceStatus');
  if(sourceStatus)tableHead.insertBefore(controls,sourceStatus);
  else tableHead.appendChild(controls);

  // Wichtig: Den ursprünglichen Filterbereich NICHT aus dem DOM entfernen.
  // Die bestehende Ersatzteil-Logik greift weiterhin auf Anlage-/Statusfilter,
  // Reset-Button und Quellencontainer zu. Der Bereich wird ausschließlich per
  // CSS ausgeblendet, damit die Logik vollständig funktionsfähig bleibt.
})();
