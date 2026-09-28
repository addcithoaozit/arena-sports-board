import assert from 'node:assert/strict';
import test from 'node:test';
import {moduleUrl} from './profile-loader.mjs';
const {announcedNpbGames}=await import(moduleUrl('lib/international-fixtures.ts'));
const headers=['台灣時間','主隊','主隊先發','客隊','客隊先發','球場'];
test('NPB official announcements retain date, home/away pitchers and venue without inventing odds',()=>{
 const [game]=announcedNpbGames([{title:'先發',headers,rows:[['2026-09-20 13:00','日本火腿鬥士','投手甲','西武獅','投手乙','球場']]}]);
 assert.equal(game.start,'2026-09-20 13:00:00');
 assert.equal(game.home,'北海道日本火腿鬥士');assert.equal(game.away,'埼玉西武獅');
 assert.deepEqual(game.starters,{home:'投手甲',away:'投手乙'});assert.equal(game.venue,'球場');assert.deepEqual(game.displayMarkets,[]);
});
test('incomplete announcements cannot become betting fixtures',()=>{
 assert.deepEqual(announcedNpbGames([{title:'先發',headers,rows:[['未知','阪神虎','投手甲','中日龍','投手乙','球場'],['2026-09-20 13:00','阪神虎','投手甲','','投手乙','球場'],['2026-09-20 13:00','阪神虎','投手甲','阪神虎','投手乙','球場']]}]),[]);
});
