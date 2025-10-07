const server = window.location.origin;

function toast(msg){
  const wrap = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className='toast';
  t.textContent=msg;
  t.style.opacity=0;
  wrap.appendChild(t);
  setTimeout(()=>{t.style.transition='opacity .4s';t.style.opacity=1;},10);
  setTimeout(()=>{t.style.opacity=0;setTimeout(()=>t.remove(),400);}, 3200);
}

async function sendForm(form, endpoint) {
  const fd = new FormData(form);
  const res = await fetch(`${server}${endpoint}`, { method: 'POST', body: fd });
  if (!res.ok) {
    const text = await res.text().catch(()=>'');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return await res.blob();
}

function showBlob(blob, filenameGuess) {
  const preview = document.getElementById('preview');
  const link = document.getElementById('download-link');
  const url = URL.createObjectURL(blob);

  if (blob.type.startsWith('image/')) {
    preview.innerHTML = `<img src="${url}" alt="preview" />`;
  } else if (blob.type === 'application/pdf') {
    preview.innerHTML = `<iframe src="${url}" title="PDF preview"></iframe>`;
  } else {
    preview.innerHTML = `<p>Hasil siap diunduh.</p>`;
  }

  link.classList.remove('hidden');
  link.href = url;
  link.download = filenameGuess || 'result';
}

function guessName(endpoint){
  if(endpoint.includes('pdf-to-word')) return 'converted.docx';
  if(endpoint.includes('word-to-pdf')) return 'converted.pdf';
  if(endpoint.includes('jpg-to-pdf')) return 'converted.pdf';
  if(endpoint.includes('pdf-to-jpg')) return 'converted.jpg';
  if(endpoint.includes('resize-jpg')) return 'resized.jpg';
  if(endpoint.includes('resize-pdf')) return 'compressed.pdf';
  if(endpoint.includes('excel-to-pdf')) return 'converted.pdf';
  return 'result';
}

function attachDropzone(dz){
  const input = dz.querySelector('input[type=file]');
  const accept = dz.getAttribute('data-accept')||'';
  const acceptList = accept.split(',').map(s=>s.trim()).filter(Boolean);

  function highlight(on){
    dz.classList.toggle('dz-pulse',on);
    dz.style.borderColor = on? '#38bdf8' : '';
  }

  dz.addEventListener('dragover', e=>{ e.preventDefault(); highlight(true); });
  dz.addEventListener('dragleave', ()=> highlight(false));
  dz.addEventListener('drop', e=>{
    e.preventDefault(); highlight(false);
    const file = e.dataTransfer.files?.[0];
    if(!file) return;
    if(acceptList.length && !acceptList.some(a=> file.type.includes(a) || file.name.toLowerCase().endsWith(a.replace(/^\./,'')) )){
      toast('Tipe file tidak didukung untuk alat ini.');
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  });

  // Animate dropzone pulse
  dz.addEventListener('animationend',()=>dz.classList.remove('dz-pulse'));
}

function wireAll(){
  document.querySelectorAll('.dropzone').forEach(attachDropzone);

  document.querySelectorAll('.tool.card').forEach(tool=>{
    const endpoint = tool.getAttribute('data-endpoint');
    const form = tool.querySelector('form');
    // Resize JPG enhancements
    if(endpoint === '/resize-jpg'){
      const width = form.querySelector('input[name=width]');
      const height = form.querySelector('input[name=height]');
      const lock = document.getElementById('lock-aspect');
      let natural = {w:null,h:null,ratio:null};

      const fileInput = form.querySelector('input[type=file]');
      fileInput.addEventListener('change',()=>{
        const f = fileInput.files?.[0];
        if(!f) return;
        const img = new Image();
        img.onload = ()=>{ natural = {w:img.naturalWidth,h:img.naturalHeight,ratio: img.naturalWidth/img.naturalHeight}; };
        img.src = URL.createObjectURL(f);
      });

      function syncHeight(){
        if(lock?.checked && width?.value && natural.ratio){
          const h = Math.round(parseInt(width.value,10) / natural.ratio);
          height.value = String(Math.max(h,1));
        }
      }
      function syncWidth(){
        if(lock?.checked && height?.value && natural.ratio){
          const w = Math.round(parseInt(height.value,10) * natural.ratio);
          width.value = String(Math.max(w,1));
        }
      }
      width?.addEventListener('input', syncHeight);
      height?.addEventListener('input', syncWidth);

      // Preset chips
      tool.querySelectorAll('.chip[data-width]')?.forEach(ch=>{
        ch.addEventListener('click',()=>{ width.value = ch.getAttribute('data-width'); syncHeight(); });
      });
    }
    form?.addEventListener('submit', async(e)=>{
      e.preventDefault();
      const preview = document.getElementById('preview');
      const link = document.getElementById('download-link');
      preview.textContent = 'Memproses…';
      link.classList.add('hidden');
      link.removeAttribute('href');
      const btn = form.querySelector('.btn');
      btn?.classList.add('loading');
      // Button ripple effect
      if(btn){
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        btn.appendChild(ripple);
        setTimeout(()=>ripple.remove(), 500);
      }
      try{
        const blob = await sendForm(form, endpoint);
        showBlob(blob, guessName(endpoint));
        toast('Berhasil diproses');
      }catch(err){
        preview.textContent = `Error: ${err.message}`;
        toast('Gagal memproses');
      } finally {
        btn?.classList.remove('loading');
      }
    });
  });

  // Animate cards on load
  document.querySelectorAll('.animated-cards>.card').forEach((card,i)=>{
    card.style.opacity=0;
    setTimeout(()=>{card.style.opacity=1;}, 120+90*i);
  });
}

document.addEventListener('DOMContentLoaded', wireAll);
