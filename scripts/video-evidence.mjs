import './guard.mjs';
import {readdir,mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const videos=[];
async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=directory+'/'+entry.name;if(entry.isDirectory())await walk(path);else if(entry.name==='video.webm'&&/(graph-interactions-|operations-All-six-panels|operations-Adaptive-six)/.test(path))videos.push(path);}}
await walk('test-results');if(videos.length<4)throw Error('Required graph and panel mouse recordings are missing');
const directory='test-results/video-review';await mkdir(directory,{recursive:true});const records=[];
for(const video of videos){
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=width,height','-of','json',video],{encoding:'utf8'});if(probe.status!==0)throw Error(probe.stderr||'Cannot inspect mouse recording');
  const metadata=JSON.parse(probe.stdout),duration=Number(metadata.format.duration),stream=metadata.streams.find(value=>value.width&&value.height);if(!duration||!stream)throw Error('Invalid mouse recording');
  const interval=video.includes('graph-interactions-')?1:3,id=createHash('sha256').update(video).digest('hex').slice(0,10),pattern=`${directory}/${id}-%02d.png`;
  const extraction=spawnSync('ffmpeg',['-v','error','-y','-i',video,'-vf',`fps=1/${interval},scale=520:-1,tile=3x4:padding=4:margin=4`,'-vsync','0',pattern],{encoding:'utf8'});if(extraction.status!==0)throw Error(extraction.stderr||'Cannot render mouse recording frames');
  const sheets=(await readdir(directory)).filter(file=>file.startsWith(id+'-')).sort();if(!sheets.length)throw Error('Mouse recording produced no review frames');
  records.push({video,duration,resolution:[stream.width,stream.height],intervalSeconds:interval,columns:3,rows:4,sheets,sha256:createHash('sha256').update(await readFile(video)).digest('hex')});
}
await writeFile(directory+'/mouse-recordings.json',JSON.stringify({commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,review:'Chronological sampled frames supplement the complete videos and actual mouse state assertions',records},null,2));
console.log(`Produced review frames for ${records.length} complete mouse recordings`);
