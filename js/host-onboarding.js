(function(){
  'use strict';
  var STORAGE_KEY='ltp-host-onboarding-v1';
  var form=document.getElementById('host-form');
  var steps=Array.prototype.slice.call(document.querySelectorAll('.form-step'));
  var progressItems=Array.prototype.slice.call(document.querySelectorAll('.signup-progress li'));
  var alertBox=document.getElementById('form-alert');
  var next=document.getElementById('next-button');
  var back=document.getElementById('back-button');
  var current=1;
  var cityController=null;
  var cityTimer=null;
  var fallbacks=[
    {name:'Aix-en-Provence',postcode:'13100',context:'Bouches-du-Rhône'},
    {name:'Marseille',postcode:'13001',context:'Bouches-du-Rhône'},
    {name:'Avignon',postcode:'84000',context:'Vaucluse'},
    {name:'Nice',postcode:'06000',context:'Alpes-Maritimes'}
  ];

  function readDraft(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{};}catch(e){return {};}}
  function values(){
    var data={};
    new FormData(form).forEach(function(value,key){
      if(data[key]!==undefined)data[key]=[].concat(data[key],value);else data[key]=value;
    });
    data.step=current;data.updatedAt=new Date().toISOString();return data;
  }
  function save(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(values()));document.getElementById('draft-state').textContent='Brouillon enregistré';}catch(e){document.getElementById('draft-state').textContent='Enregistrement indisponible';}
  }
  function restore(){
    var draft=readDraft();
    Object.keys(draft).forEach(function(name){
      if(['step','updatedAt','hostId','status'].indexOf(name)!==-1)return;
      var wanted=Array.isArray(draft[name])?draft[name]:[draft[name]];
      form.querySelectorAll('[name="'+CSS.escape(name)+'"]').forEach(function(el){
        if(el.type==='checkbox'||el.type==='radio')el.checked=wanted.indexOf(el.value)!==-1;else el.value=draft[name];
      });
    });
  }
  function showAlert(message,field){
    alertBox.textContent=message;alertBox.hidden=false;
    if(field){field.focus();field.scrollIntoView({behavior:'smooth',block:'center'});}
  }
  function clearAlert(){alertBox.hidden=true;alertBox.textContent='';}
  function selectedCount(name){return form.querySelectorAll('[name="'+name+'"]:checked').length;}
  function validateStep(){
    clearAlert();
    var section=steps[current-1];
    if(current===1){
      if(!section.querySelector('[name="place_type"]:checked')){showAlert('Choisissez piscine, jacuzzi ou sauna.',section.querySelector('[name="place_type"]'));return false;}
      var address=section.querySelector('[name="address"]'),city=section.querySelector('[name="city"]');
      if(address.value.trim().length<4){showAlert('Indiquez l’adresse exacte de votre lieu.',address);return false;}
      if(city.value.trim().length<2){showAlert('Indiquez la ville ou le village.',city);return false;}
    }
    if(current===2){
      if(!selectedCount('formats')){showAlert('Activez au moins un format de réservation.',section.querySelector('[name="formats"]'));return false;}
      var capacity=section.querySelector('[name="capacity"]');
      if(Number(capacity.value)<1||Number(capacity.value)>30){showAlert('La capacité doit être comprise entre 1 et 30 personnes.',capacity);return false;}
      var rules={open:['price_open',6],private:['price_private',40],half:['price_half',90],day:['price_day',120]};
      var active=Array.prototype.slice.call(section.querySelectorAll('[name="formats"]:checked'));
      for(var i=0;i<active.length;i++){
        var rule=rules[active[i].value],field=section.querySelector('[name="'+rule[0]+'"]');
        if(Number(field.value)<rule[1]){showAlert('Le prix minimum pour ce format est de '+rule[1]+' €.',field);return false;}
      }
    }
    if(current===3){
      if(!selectedCount('days')){showAlert('Choisissez au moins un jour disponible.',section.querySelector('[name="days"]'));return false;}
      var start=section.querySelector('[name="start_time"]'),end=section.querySelector('[name="end_time"]');
      if(!start.value||!end.value||start.value>=end.value){showAlert('L’heure de fermeture doit être après l’ouverture.',end);return false;}
    }
    if(current===4){
      var required=Array.prototype.slice.call(section.querySelectorAll('[required]'));
      for(var j=0;j<required.length;j++){
        if(!required[j].checkValidity()){showAlert(required[j].name==='terms'?'Acceptez les conditions hôtes pour continuer.':'Vérifiez les informations de votre compte.',required[j]);return false;}
      }
    }
    return true;
  }
  function render(){
    steps.forEach(function(step,index){var active=index===current-1;step.hidden=!active;step.classList.toggle('active',active);});
    progressItems.forEach(function(item,index){item.classList.toggle('active',index===current-1);item.classList.toggle('done',index<current-1);});
    document.getElementById('progress-label').textContent='Étape '+current+' sur 4';
    document.getElementById('progress-percent').textContent=(current*25)+' %';
    document.getElementById('progress-bar').style.width=(current*25)+'%';
    back.hidden=current===1;
    next.innerHTML=current===4?'Créer mon compte <span>→</span>':'Continuer <span>→</span>';
    clearAlert();window.scrollTo({top:0,behavior:'smooth'});
  }
  function finish(){
    var draft=values();draft.hostId='host-'+Date.now();draft.status='draft';draft.completedAt=new Date().toISOString();
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(draft));}catch(e){}
    steps.forEach(function(step){step.hidden=true;});
    document.getElementById('form-actions').hidden=true;
    document.querySelector('.signup-progress').hidden=true;
    document.getElementById('signup-success').hidden=false;
    document.getElementById('signup-success').scrollIntoView({behavior:'smooth',block:'start'});
  }

  next.addEventListener('click',function(){if(!validateStep())return;save();if(current===4)finish();else{current++;render();}});
  back.addEventListener('click',function(){if(current>1){save();current--;render();}});
  form.addEventListener('input',function(){document.getElementById('draft-state').textContent='Enregistrement…';clearTimeout(form._saveTimer);form._saveTimer=setTimeout(save,450);});

  var cityInput=document.getElementById('host-city'),results=document.getElementById('city-results');
  function renderCities(cities){
    results.innerHTML=cities.slice(0,6).map(function(city){return '<button type="button" role="option" data-name="'+String(city.name).replace(/"/g,'&quot;')+'">'+city.name+'<small>'+city.context+' · '+city.postcode+'</small></button>';}).join('');
    results.hidden=!cities.length;
  }
  cityInput.addEventListener('input',function(){
    var query=this.value.trim();clearTimeout(cityTimer);if(query.length<2){results.hidden=true;return;}
    cityTimer=setTimeout(function(){
      if(cityController)cityController.abort();cityController=new AbortController();
      fetch('https://geo.api.gouv.fr/communes?nom='+encodeURIComponent(query)+'&fields=nom,codesPostaux,departement&boost=population&limit=6',{signal:cityController.signal})
        .then(function(response){if(!response.ok)throw new Error('api');return response.json();})
        .then(function(items){renderCities(items.map(function(item){return {name:item.nom,postcode:(item.codesPostaux||[''])[0],context:item.departement?item.departement.nom:'France'};}));})
        .catch(function(error){if(error.name!=='AbortError')renderCities(fallbacks.filter(function(city){return city.name.toLowerCase().indexOf(query.toLowerCase())!==-1;}));});
    },240);
  });
  results.addEventListener('click',function(event){var option=event.target.closest('[data-name]');if(!option)return;cityInput.value=option.dataset.name;results.hidden=true;save();});
  document.addEventListener('click',function(event){if(!event.target.closest('.city-field'))results.hidden=true;});

  restore();render();
})();
