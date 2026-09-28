import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {moduleUrl} from './profile-loader.mjs';
const {playerPhotoKey,withPlayerPhotos}=await import(moduleUrl('lib/international-player-photos.ts'));
test('normalizes handedness markers, compatible Japanese letters and English name order',()=>{
 for(const [a,b]of [['* 伊原 陵人','伊原　陵人'],['+ 植田 海','植田 海'],['#許基宏','許基宏'],['Hyun-soo Kim','KIM Hyun Soo'],['Lewin Díaz','DIAZ Lewin'],['伊藤 大海','伊藤 大海']])assert.equal(playerPhotoKey(a),playerPhotoKey(b));
 assert.notEqual(playerPhotoKey('Kim Min Soo'),playerPhotoKey('Kim Hyun Soo'));
});
test('NPB replacement portraits are tied to their verified team and name and survive a source outage',()=>{
 const audit=JSON.parse(readFileSync('data/npb-player-photo-audit-20260928.json','utf8'));
 assert.equal(audit.catalogGapsResolved.length,9);
 for(const person of audit.catalogGapsResolved){
  const [league,team]=person.team.split(':'),raw={bat:{rows:[[person.name,'7']]},pit:{rows:[[person.name,'4.20']]},photos:{},status:'stale',fetchedAt:'2026-09-23T00:00:00Z'};
  const data=withPlayerPhotos(raw,league,team,2026);
  assert.equal(data.photos[person.name],person.url);
  assert.deepEqual(data.photoAlternatives[person.name],[person.url,person.originalImage]);
  assert.equal(data.photoSources[person.name],person.source);
  assert.equal(data.photosUpdatedAt,audit.checkedAt);
  assert.equal(data.bat,raw.bat);assert.equal(data.pit,raw.pit);assert.equal(data.fetchedAt,raw.fetchedAt);assert.equal(data.status,'stale');
  assert.equal(withPlayerPhotos(raw,'NPB','g',2026).photos[person.name],undefined);
  assert.equal(withPlayerPhotos(raw,'NPB',team,2027),raw);
  const bytes=readFileSync('public'+person.url);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),person.sha256);
  assert.equal(bytes.readUInt16BE(0),0xffd8);assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9);
 }
});
test('verified photos survive statistics outages without changing statistics or crossing teams/seasons',()=>{
 const raw={status:'stale',fetchedAt:'2026-09-19',bat:{rows:[['石黒 佑弥','12'],['+ 植田 海','3']]},pit:null};
 const out=withPlayerPhotos(raw,'NPB','t',2026);assert.match(out.photos['石黒 佑弥'],/^https:\/\//);assert.ok(out.photos['+ 植田 海']);assert.equal(out.bat,raw.bat);assert.equal(out.fetchedAt,raw.fetchedAt);assert.equal(out.status,'stale');assert.equal(raw.photos,undefined);
 assert.equal(withPlayerPhotos(raw,'NPB','t',2027),raw);assert.deepEqual(withPlayerPhotos(raw,'NPB','g',2026).photos,{});assert.deepEqual(withPlayerPhotos(raw,'MLB','t',2026).photos,{});
});
