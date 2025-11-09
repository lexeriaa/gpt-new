#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const HELP = `\nKullanım: gpt-new <URL> [seçenekler]\n       : vidget <URL> [seçenekler]\n\nSeçenekler:\n  -o, --output <dir>       Çıktı klasörü (varsayılan: Kullanıcı/Downloads/video-get)\n  -a, --audio              Sadece ses indir (mp3, en yüksek kalite)\n  --sub                    Altyazı indir ve srt'e çevir (varsa)\n  --cookies <browser>      Tarayıcı çerezleri (chrome|edge|firefox)\n  -f, --format <fmt>       Özel yt-dlp format ifadesi\n  --playlist               Playlist indirmeyi etkinleştir\n  --no-playlist            Playlist indirmeyi kapat (varsayılan)\n  -h, --help               Bu yardımı göster\n\nÖrnek:\n  vidget https://www.youtube.com/watch?v=ID -o D:/Videolar\n  vidget -a https://twitter.com/...\n  vidget --cookies chrome https://www.instagram.com/p/...\n`;

function parseArgs(argv){
  const out = { url: null, output: null, audio: false, sub: false, cookies: null, format: null, playlist: false, help: false };
  const args = [...argv];
  while(args.length){
    const a = args.shift();
    if(!out.url && !a.startsWith('-')){ out.url = a; continue; }
    switch(a){
      case '-o': case '--output': out.output = args.shift(); break;
      case '-a': case '--audio': out.audio = true; break;
      case '--sub': out.sub = true; break;
      case '--cookies': out.cookies = args.shift(); break;
      case '-f': case '--format': out.format = args.shift(); break;
      case '--playlist': out.playlist = true; break;
      case '--no-playlist': out.playlist = false; break;
      case '-h': case '--help': out.help = true; break;
      default:
        if(!out.url && !a.startsWith('-')) out.url = a; else {
          console.error('Bilinmeyen seçenek:', a); out.help = true;
        }
    }
  }
  return out;
}

function defaultDownloadDir(){
  const home = process.env.USERPROFILE || process.env.HOME || process.cwd();
  const dir = path.join(home, 'Downloads', 'video-get');
  if(!existsSync(dir)) mkdirSync(dir, {recursive:true});
  return dir;
}

function which(cmd){
  return new Promise((resolve)=>{
    const p = spawn(process.platform === 'win32' ? 'where' : 'which', [cmd]);
    let out=''; p.stdout.on('data', d=> out+=d.toString());
    p.on('close', (code)=> resolve(code===0 ? out.trim() : ''));
  });
}

async function ensureBins(){
  let ytdlp = await which('yt-dlp');
  let ff = await which('ffmpeg');
  if(!ytdlp){
    const wingetLinks = path.join(process.env.LOCALAPPDATA||'', 'Microsoft','WinGet','Packages');
    const ytdlpPath = path.join(wingetLinks, 'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe', 'yt-dlp.exe');
    if(existsSync(ytdlpPath)) ytdlp = ytdlpPath;
  }
  if(!ff){
    const wingetFF = path.join(process.env.LOCALAPPDATA||'', 'Microsoft','WinGet','Packages','yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe','ffmpeg-N-121583-g4348bde2d2-win64-gpl','bin','ffmpeg.exe');
    if(existsSync(wingetFF)) ff = wingetFF;
  }
  return { ytdlp, ff };
}

async function main(){
  const opts = parseArgs(process.argv.slice(2));
  if(opts.help || !opts.url){ console.log(HELP); process.exit(opts.help?0:1); }

  const outDir = opts.output || defaultDownloadDir();
  const { ytdlp, ff } = await ensureBins();
  if(!ytdlp){
    console.error('yt-dlp bulunamadı. Lütfen yeniden terminal açın veya yt-dlp kurulumu yapın.');
    process.exit(2);
  }
  const args = [];
  args.push(opts.url);
  args.push('-N','8');
  args.push('--restrict-filenames');
  args.push('-o', path.join(outDir, '%(title).200B [%(id)s].%(ext)s'));
  if(!opts.playlist) args.push('--no-playlist');
  if(opts.cookies) args.push('--cookies-from-browser', opts.cookies);
  if(opts.sub){ args.push('--write-auto-sub','--sub-langs','en,tr,live_chat','--convert-subs','srt'); }
  if(opts.audio){
    args.push('-f', opts.format || 'bestaudio/best','--extract-audio','--audio-format','mp3','--audio-quality','0');
  } else {
    args.push('-f', opts.format || 'bv*+ba/best');
    args.push('--merge-output-format','mp4');
  }
  if(ff){ process.env.PATH = path.dirname(ff) + path.delimiter + process.env.PATH; }

  console.log(`İndiriliyor → ${opts.url}\nKlasör → ${outDir}`);
  const p = spawn(ytdlp, args, { stdio: 'inherit' });
  p.on('close', (code)=> process.exit(code));
}

main().catch((e)=>{ console.error(e); process.exit(1); });