'use strict';

const $ = selector => document.querySelector(selector);
const STORAGE_KEY = 'tabien-khum-v1';
const CENTER = [13.9166, 100.4240]; // เทศบาลนครบางบัวทอง

let data = { records: [], categories: [] };
let map = null;
let selected = null;
let pinMode = false;
const markers = new Map();

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const hasPin = record => Boolean(
  record.latitude && record.longitude &&
  Number.isFinite(Number(record.latitude)) &&
  Number.isFinite(Number(record.longitude))
);

const notice = (message, error = false) => {
  const el = $('#notice');
  el.textContent = message;
  el.className = error ? 'error' : '';
};

const CLOUD_API_KEY = 'tabien_khum_cloud_api';
const DEFAULT_CLOUD_API = 'https://tabien-khum-api.nathphathrpladprakhon.workers.dev';
function getCloudApiUrl() {
  const saved = localStorage.getItem(CLOUD_API_KEY);
  if (saved === 'none' || saved === '') return '';
  if (saved === null || saved === undefined) return DEFAULT_CLOUD_API;
  return saved.trim().replace(/\/+$/, '');
}

async function syncRecordToCloud(record) {
  const cloudUrl = getCloudApiUrl();
  if (!cloudUrl || !record || !record.id) return;
  try {
    await fetch(`${cloudUrl}/api/records/${record.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
  } catch (err) {
    console.warn('Sync pin to Cloudflare failed:', err);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// โหลดข้อมูล และรวมพิกัดจาก initial.json ในกรณีที่ localStorage ข้อมูลเก่าไม่มีพิกัด
async function loadData() {
  try {
    let initialData = (typeof window !== 'undefined' && window.SEED_DATA) || null;
    if (!initialData) {
      try {
        const response = await fetch('initial.json');
        if (response.ok) initialData = await response.json();
      } catch (e) {}
    }
    const initialMap = new Map();
    (initialData.records || []).forEach(r => {
      if (r.id && hasPin(r)) initialMap.set(Number(r.id), r);
      else if (r.name && hasPin(r)) initialMap.set(r.name.trim(), r);
    });

    const DATA_VER = '20261008_dmy_v2';
    const isMigrated = localStorage.getItem('tabien_khum_data_ver') === DATA_VER;

    const stored = localStorage.getItem(STORAGE_KEY);
    let hasValidStored = false;
    if (stored && isMigrated) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
          data = parsed;
          hasValidStored = true;
        }
      } catch (e) {}
    }

    if (!hasValidStored && initialData && Array.isArray(initialData.records) && initialData.records.length > 0) {
      const pinMap = new Map();
      if (stored) {
        try {
          const p = JSON.parse(stored);
          (p.records || []).forEach(r => {
            if (r.latitude && r.longitude) pinMap.set(Number(r.id), { lat: r.latitude, lng: r.longitude, src: r.mapSource });
          });
        } catch (_) {}
      }
      data = JSON.parse(JSON.stringify(initialData));
      data.records = (data.records || []).map((r, i) => {
        const pin = pinMap.get(r.id || i + 1);
        return {
          ...r,
          id: r.id || i + 1,
          latitude: pin ? pin.lat : (r.latitude || null),
          longitude: pin ? pin.lng : (r.longitude || null),
          mapSource: pin ? pin.src : (r.mapSource || null)
        };
      });
      save();
      localStorage.setItem('tabien_khum_data_ver', DATA_VER);
    } else if (hasValidStored && initialData && Array.isArray(initialData.records)) {
      // หากมี record ใน localStorage ที่ยังไม่มีพิกัด ให้นำพิกัดจาก initialData มาใส่
      let mergedCount = 0;
      data.records.forEach((r, idx) => {
        if (!r.id) r.id = idx + 1;
        if (!hasPin(r)) {
          const match = initialMap.get(Number(r.id)) || initialMap.get(String(r.name || '').trim());
          if (match && hasPin(match)) {
            r.latitude = match.latitude;
            r.longitude = match.longitude;
            r.mapSource = match.mapSource || 'auto-free';
            mergedCount++;
          }
        }
      });
      if (mergedCount > 0) {
        save();
      }
    }
  } catch (err) {
    console.error('Error loading initial.json', err);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { data = JSON.parse(stored); } catch (e) {}
    }
  }

  initMap();
  renderList();
  renderMarkers();
  updateStats();

  // ตรวจสอบ query string เช่น ?id=123 เพื่อเลือกกิจการทันที
  const requested = Number(new URLSearchParams(location.search).get('id'));
  if (requested) {
    const record = data.records.find(item => Number(item.id) === requested);
    if (record) selectRecord(record);
  }
}

function initMap() {
  if (map) return;
  // Initialize Leaflet map
  map = L.map('map', {
    center: CENTER,
    zoom: 13,
    zoomControl: true
  });

  // OpenStreetMap tile layer (100% Free, No API key)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  map.on('click', event => {
    if (pinMode && selected) {
      setPin(selected, event.latlng.lat, event.latlng.lng, true);
    }
  });
}

function updateStats() {
  const pinned = data.records.filter(hasPin).length;
  $('#totalCount').textContent = data.records.length.toLocaleString('th-TH');
  $('#pinnedCount').textContent = pinned.toLocaleString('th-TH');
  $('#unplacedCount').textContent = (data.records.length - pinned).toLocaleString('th-TH');
}

function renderList() {
  const query = $('#search').value.trim().toLowerCase();
  const filter = $('#pinFilter').value;
  const records = data.records.filter(record =>
    (filter === 'all' || (filter === 'pinned' && hasPin(record)) || (filter === 'missing' && !hasPin(record))) &&
    (!query || JSON.stringify([record.name, record.address, record.code, record.business, record.category]).toLowerCase().includes(query))
  );

  $('#businessList').innerHTML = records.map(record => `
    <button class="business-card ${selected?.id === record.id ? 'active' : ''}" data-id="${record.id}">
      <span class="pin-status ${hasPin(record) ? '' : 'missing'}">${hasPin(record) ? 'มีหมุด' : 'รอปักหมุด'}</span>
      <b>${escapeHTML(record.name || 'ไม่ระบุชื่อ')}</b>
      <span>${escapeHTML(record.address || 'ไม่ระบุที่อยู่')}</span>
      <small>${escapeHTML(record.code || '—')} • ${escapeHTML(record.business || '')}</small>
    </button>
  `).join('') || '<p style="padding:20px;color:#71847e;text-align:center;">ไม่พบกิจการที่ตรงกับเงื่อนไข</p>';
}

function createPopupContent(record) {
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  const googleNavUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  return `
    <b>${escapeHTML(record.name || 'ไม่ระบุชื่อ')}</b>
    <span class="popup-code">${escapeHTML(record.code || '—')}</span>
    <div class="popup-address">${escapeHTML(record.address || '')}</div>
    <div style="color:#6f8680;font-size:11px;margin-bottom:6px;">${escapeHTML(record.business || '')}</div>
    <div class="popup-actions">
      <a class="popup-nav" href="${googleNavUrl}" target="_blank" rel="noopener">↗ เปิดนำทาง Google Maps</a>
    </div>
  `;
}

function markerFor(record) {
  if (!hasPin(record) || !map) return null;
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);

  const marker = L.marker([lat, lng], {
    title: record.name || 'กิจการ',
    draggable: true
  });

  marker.bindPopup(createPopupContent(record));

  marker.on('click', () => {
    selectRecord(record, false);
  });

  marker.on('dragend', event => {
    const pos = event.target.getLatLng();
    setPin(record, pos.lat, pos.lng, false);
  });

  marker.addTo(map);
  markers.set(Number(record.id), marker);
  return marker;
}

function renderMarkers() {
  if (!map) return;
  markers.forEach(marker => map.removeLayer(marker));
  markers.clear();
  data.records.forEach(markerFor);
  updateStats();
}

function selectRecord(record, moveMap = true) {
  selected = record;
  renderList();
  $('#selection').hidden = false;
  $('#selectedName').textContent = record.name || 'ไม่ระบุชื่อ';
  $('#selectedAddress').textContent = record.address || 'ไม่ระบุที่อยู่';
  $('#selectedCategory').textContent = `${record.code || ''} • ${record.business || ''}`;
  $('#deletePin').disabled = !hasPin(record);

  if (hasPin(record)) {
    const lat = Number(record.latitude);
    const lng = Number(record.longitude);
    if (moveMap && map) {
      map.flyTo([lat, lng], 16, { duration: 0.8 });
    }
    const marker = markers.get(Number(record.id));
    if (marker) {
      setTimeout(() => marker.openPopup(), 400);
    }
  }
}

function setPin(record, latitude, longitude, focus = true) {
  record.latitude = Number(latitude).toFixed(6);
  record.longitude = Number(longitude).toFixed(6);
  record.mapSource = 'manual';
  save();
  syncRecordToCloud(record);

  const old = markers.get(Number(record.id));
  if (old) map.removeLayer(old);

  const marker = markerFor(record);
  pinMode = false;
  document.body.classList.remove('pin-mode');
  updateStats();
  renderList();
  $('#deletePin').disabled = false;
  notice(`บันทึกตำแหน่งหมุดของ "${record.name || 'กิจการ'}" เรียบร้อยแล้ว`);

  if (focus && map) {
    map.flyTo([latitude, longitude], 16);
    if (marker) marker.openPopup();
  }
}

function deletePin() {
  if (!selected || !hasPin(selected) || !confirm(`ยืนยันการลบหมุดของ "${selected.name || 'กิจการ'}"?`)) return;
  delete selected.latitude;
  delete selected.longitude;
  delete selected.mapSource;
  const marker = markers.get(Number(selected.id));
  if (marker) map.removeLayer(marker);
  markers.delete(Number(selected.id));
  save();
  syncRecordToCloud(selected);
  updateStats();
  renderList();
  $('#deletePin').disabled = true;
  notice('ลบตำแหน่งหมุดเรียบร้อย');
}

function fitAll() {
  if (!map) return;
  const valid = data.records.filter(hasPin);
  if (!valid.length) {
    map.setView(CENTER, 13);
    return;
  }
  const bounds = L.latLngBounds(valid.map(r => [Number(r.latitude), Number(r.longitude)]));
  map.fitBounds(bounds, { padding: [40, 40] });
}

// ฟังก์ชันซิงค์พิกัดเริ่มต้นจาก initial.json ทั้งหมด
async function syncInitialPins() {
  if (!confirm('ต้องการตรวจสอบและซิงค์พิกัดเริ่มต้นฟรีทั้งหมดจากฐานข้อมูลหรือไม่?')) return;
  try {
    $('#progress').hidden = false;
    $('#progressText').textContent = 'กำลังโหลดพิกัดเริ่มต้น…';
    const res = await fetch('initial.json');
    const initialData = await res.json();
    const initialMap = new Map();
    (initialData.records || []).forEach(r => {
      if (r.id && hasPin(r)) initialMap.set(Number(r.id), r);
      else if (r.name && hasPin(r)) initialMap.set(r.name.trim(), r);
    });

    let updated = 0;
    data.records.forEach(r => {
      if (!hasPin(r)) {
        const match = initialMap.get(Number(r.id)) || initialMap.get(String(r.name || '').trim());
        if (match && hasPin(match)) {
          r.latitude = match.latitude;
          r.longitude = match.longitude;
          r.mapSource = match.mapSource || 'auto-free';
          updated++;
        }
      }
    });

    save();
    renderMarkers();
    renderList();
    updateStats();
    $('#progress').hidden = true;
    notice(`ซิงค์พิกัดเรียบร้อย (${updated} รายการใหม่ได้รับการปักหมุด)`);
    fitAll();
  } catch (err) {
    $('#progress').hidden = true;
    notice('ซิงค์พิกัดไม่สำเร็จ: ' + err.message, true);
  }
}

// Event Listeners
$('#businessList').onclick = event => {
  const card = event.target.closest('[data-id]');
  if (card) {
    selectRecord(data.records.find(record => Number(record.id) === Number(card.dataset.id)));
  }
};

$('#search').oninput = renderList;
$('#pinFilter').onchange = renderList;
$('#fitAll').onclick = fitAll;
$('#syncPins').onclick = syncInitialPins;

$('#addPin').onclick = () => {
  if (!selected) return;
  pinMode = true;
  document.body.classList.add('pin-mode');
  notice(`โหมดปักหมุดเปิดอยู่: กรุณาคลิกบนแผนที่ ณ ตำแหน่งที่ต้องการวางหมุดของ "${selected.name || 'กิจการ'}"`);
};

$('#deletePin').onclick = deletePin;

$('#currentLocation').onclick = () => {
  if (!selected) return;
  if (!navigator.geolocation) return notice('อุปกรณ์นี้ไม่รองรับการระบุพิกัด GPS', true);
  notice('กำลังค้นหาตำแหน่ง GPS ปัจจุบัน…');
  navigator.geolocation.getCurrentPosition(
    position => {
      setPin(selected, position.coords.latitude, position.coords.longitude, true);
      notice('บันทึกพิกัดจาก GPS เรียบร้อย');
    },
    error => {
      notice('ไม่สามารถอ่านตำแหน่ง GPS ได้: ' + error.message, true);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

$('#openExternalMap').onclick = () => {
  if (!selected || !hasPin(selected)) return notice('กรุณาเลือกกิจการที่มีหมุดก่อน', true);
  const url = `https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`;
  window.open(url, '_blank');
};

loadData().catch(error => notice(error.message, true));
