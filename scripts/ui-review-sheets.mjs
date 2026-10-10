import './guard.mjs';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const images=[];
async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=directory+'/'+entry.name;if(entry.isDirectory())await walk(path);else if(entry.name.endsWith('.png')&&path.includes('visual-review-'))images.push(path);}}
await walk('test-results');images.sort();if(!images.length)throw Error('UI screenshots are missing');
const directory='test-results/ui-review';await mkdir(directory,{recursive:true});const sheets=[];
for(let offset=0;offset<images.length;offset+=9){const batch=images.slice(offset,offset+9),args=['-v','error','-y'];for(const file of batch)args.push('-i',file);
  const filters=batch.map((file,index)=>`[${index}:v]scale=360:240:force_original_aspect_ratio=decrease,pad=360:264:(ow-iw)/2:0:color=0x071018,drawtext=text='${offset+index+1}':x=8:y=244:fontcolor=white:fontsize=16[v${index}]`);
  const layout=batch.map((file,index)=>`${index%3*360}_${Math.floor(index/3)*264}`).join('|');
  const output=`${directory}/surfaces-${String(sheets.length+1).padStart(2,'0')}.png`;
  filters.push(`${batch.map((file,index)=>`[v${index}]`).join('')}xstack=inputs=${batch.length}:layout=${layout}:fill=0x071018[out]`);
  const result=spawnSync('ffmpeg',[...args,'-filter_complex',filters.join(';'),'-map','[out]','-frames:v','1',output],{encoding:'utf8'});if(result.status!==0)throw Error(result.stderr||'UI review sheet failed');
  sheets.push({file:output,images:batch.map((file,index)=>({number:offset+index+1,file}))});
}
await writeFile(directory+'/surface-index.json',JSON.stringify({commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,count:images.length,sheets},null,2));
console.log(`Created ${sheets.length} review sheets for ${images.length} UI screenshots`);
