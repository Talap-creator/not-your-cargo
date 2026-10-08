# NOT YOUR CARGO — original procedural audio

Synthesized procedurally with ffmpeg (see generate.sh); no third-party audio; licence: project-owned.

## Rebuild

From the assets directory, run `bash out/sfx/generate.sh`. Requires Bash, Python 3 (`python`), ffmpeg with libvorbis, and ffprobe. All synthesis commands are in the generator; the exact expanded commands from this run are recorded below. Fixed noise seeds make the synthesis repeatable. Existing source media is never read or changed.

**Packaging exception:** higher-priority editor instructions require generated media under `out/`, so this normal, physical package is `out/sfx/`, not the requested direct `sfx/`. No symlinks or junctions are created. The script replaces only its own generated outputs and removes its temporary `.work` directory when it exits.

## Files and verification

Every file is mono, 44100 Hz, OGG Vorbis encoded with `libvorbis -q:a 4`. Each passed individual ffprobe codec/channel/rate/duration assertions and a complete `ffmpeg -v error -i FILE -f null -` decode. Duration tolerance: 2 ms. Loudness is measured from the final Vorbis decode, using loudnorm's input measurements. Short effects are repeated without silence to at least 4.8 seconds for meaningful integrated LUFS; standalone effects shorter than 400 ms cannot yield a standard integrated reading. Gain is static, measured using loudnorm, with initial 1.8 dB pre-encode true-peak headroom and up to three codec-aware gain passes. All measured levels are within 1 LU of their target and final true peaks below -0.5 dBTP.

| File | Duration (s) | LUFS-I | True peak (dBTP) | Bytes | Design |
|---|---:|---:|---:|---:|---|
| shot_mg.ogg | 0.080 | -15.92 | -1.37 | 4666 | Sharp dry noise crack with a descending low mechanical thump. |
| shot_shotgun.ogg | 0.250 | -16.43 | -1.44 | 6131 | Heavy close-range boom with a gritty debris/noise tail. |
| shot_enemy.ogg | 0.100 | -15.96 | -2.39 | 4877 | Thin high raider shot, distinct from the courier weapons. |
| hit.ogg | 0.120 | -16.13 | -2.00 | 4574 | Short inharmonic sheet-metal clank and impact grit. |
| hurt.ogg | 0.200 | -16.02 | -1.73 | 4812 | Dull body/chassis thud with a low damaged-power tone. |
| dash.ogg | 0.250 | -16.03 | -5.46 | 6253 | Low-to-high crossfiltered thruster whoosh with a rising motor chirp. |
| pickup.ogg | 0.300 | -16.16 | -9.17 | 4561 | Two rounded rising cargo-confirmation blips, E5 to B5. |
| drop.ogg | 0.200 | -15.99 | -3.38 | 4387 | Falling cargo blip followed by a low landing thud. |
| deliver.ogg | 0.700 | -15.97 | -6.82 | 5956 | Bright three-note rising delivery arpeggio, C5 E5 G5. |
| death.ogg | 0.800 | -15.89 | -1.88 | 8399 | Destruction crack followed by a long collapsing engine rumble. |
| tick.ogg | 0.080 | -15.96 | -2.83 | 4057 | Dry precise metallic counter tick. |
| win.ogg | 1.200 | -15.94 | -9.34 | 6642 | Four-note major success jingle, C4 E4 G4 C5. |
| lose.ogg | 1.200 | -15.98 | -8.05 | 6023 | Descending D-minor-coloured failure motif, A4 F4 D4 A3. |
| ui_click.ogg | 0.050 | -15.78 | -0.92 | 4281 | Soft rounded console click without a harsh high-frequency snap. |
| music_loop.ogg | 32.000 | -22.03 | -6.09 | 93294 | Seamless dark desert drone, gritty wind-like sine-bank texture and 90 BPM low pulse. |

14 SFX: **75,619 bytes** (<600 KB). Music: **93,294 bytes** (<350 KB). All 15 OGGs combined: **168,913 bytes** (<600 KB). Limits use decimal KB.

## Music loop

32.000 seconds, exactly 1,411,200 decoded samples and 48 pulses at 90 BPM. All source oscillators and modulators are integer-cycle periodic across 32 seconds. No non-periodic noise, startup filters, global fade, or reverb tail is used. The decoded boundary step is 0.00017701 full scale (-75.04 dBFS); ordinary adjacent-sample RMS step is 0.00187127. The boundary passed the numerical continuity threshold (<0.005 full scale and <5 times RMS step). Use gapless playback of the entire file, with no playback padding. Actual game-engine gapless playback and subjective listening were not tested.

The ambient texture is a deterministic inharmonic sine bank, not sampled wind. UI and success tones are original motifs, not recreated recordings.

## Exact executed audio commands

Paths under `.work` are temporary and removed after verification. LUFS analysis repeats are explicitly shown as `-stream_loop N`. Synthesis input strings below are shell-escaped by Bash (`printf %q`); they can be copied into Bash.

```bash
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i anoisesrc=r=44100:d=0.08:c=white:s=101:a=0.55\,highpass=f=550\,lowpass=f=9200\,afade=t=out:st=0:d=0.068\[n\]\;aevalsrc=exprs=\'0.8\*sin\(2\*PI\*\(65\*t+3.5\*\(1-exp\(-75\*t\)\)\)\)\*exp\(-65\*t\)\':s=44100:d=0.08\[b\]\;\[n\]\[b\]amix=inputs=2:normalize=0 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.0672:d=0.0128 -t 0.08 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/shot_mg.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 59 -i out/sfx/.work/shot_mg.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/shot_mg.wav -af volume=-2.77dB -t 0.08 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ shot_mg -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/shot_mg.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 59 -i out/sfx/shot_mg.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/shot_mg.wav -af volume=-2.300000000000001dB -t 0.08 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ shot_mg -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/shot_mg.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 59 -i out/sfx/shot_mg.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/shot_mg.ogg 
ffmpeg -v error -nostdin -i out/sfx/shot_mg.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i anoisesrc=r=44100:d=0.25:c=white:s=102:a=0.8\,highpass=f=180\,lowpass=f=6500\,afade=t=out:st=0:d=0.24\[n\]\;aevalsrc=exprs=\'1.1\*sin\(2\*PI\*\(43\*t+7\*\(1-exp\(-32\*t\)\)\)\)\*exp\(-19\*t\)+0.22\*sin\(2\*PI\*123\*t\)\*exp\(-32\*t\)\':s=44100:d=0.25\[b\]\;\[n\]\[b\]amix=inputs=2:normalize=0 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.225:d=0.025 -t 0.25 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/shot_shotgun.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 19 -i out/sfx/.work/shot_shotgun.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/shot_shotgun.wav -af volume=-5.51dB -t 0.25 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ shot_shotgun -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/shot_shotgun.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 19 -i out/sfx/shot_shotgun.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/shot_shotgun.wav -af volume=-5.17dB -t 0.25 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ shot_shotgun -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/shot_shotgun.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 19 -i out/sfx/shot_shotgun.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/shot_shotgun.wav -af volume=-5.1899999999999995dB -t 0.25 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ shot_shotgun -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/shot_shotgun.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 19 -i out/sfx/shot_shotgun.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/shot_shotgun.ogg 
ffmpeg -v error -nostdin -i out/sfx/shot_shotgun.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i anoisesrc=r=44100:d=0.1:c=white:s=103:a=0.55\,highpass=f=1700\,lowpass=f=10000\,afade=t=out:st=0:d=0.09\[n\]\;aevalsrc=exprs=\'0.27\*sin\(2\*PI\*\(380\*t+4\*\(1-exp\(-65\*t\)\)\)\)\*exp\(-42\*t\)\':s=44100:d=0.1\[b\]\;\[n\]\[b\]amix=inputs=2:normalize=0 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.084:d=0.016 -t 0.1 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/shot_enemy.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 47 -i out/sfx/.work/shot_enemy.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/shot_enemy.wav -af volume=-0.34999999999999964dB -t 0.1 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ shot_enemy -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/shot_enemy.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 47 -i out/sfx/shot_enemy.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/shot_enemy.wav -af volume=1.7763568394002505e-15dB -t 0.1 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ shot_enemy -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/shot_enemy.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 47 -i out/sfx/shot_enemy.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/shot_enemy.ogg 
ffmpeg -v error -nostdin -i out/sfx/shot_enemy.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i aevalsrc=exprs=\'\(0.55\*sin\(2\*PI\*763\*t\)+0.3\*sin\(2\*PI\*1289\*t\)+0.2\*sin\(2\*PI\*2117\*t\)+0.15\*sin\(2\*PI\*3461\*t\)\)\*exp\(-27\*t\)\':s=44100:d=0.12\[m\]\;anoisesrc=r=44100:d=0.12:c=white:s=104:a=0.3\,bandpass=f=2700:width_type=h:w=2600\,afade=t=out:st=0:d=0.024\[n\]\;\[m\]\[n\]amix=inputs=2:normalize=0 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.1008:d=0.0192 -t 0.12 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/hit.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 39 -i out/sfx/.work/hit.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/hit.wav -af volume=-2.33dB -t 0.12 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ hit -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/hit.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 39 -i out/sfx/hit.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/hit.ogg 
ffmpeg -v error -nostdin -i out/sfx/hit.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i aevalsrc=exprs=\'0.85\*sin\(2\*PI\*\(58\*t+1.5\*\(1-exp\(-35\*t\)\)\)\)\*exp\(-16\*t\)+0.25\*sin\(2\*PI\*91\*t\)\*exp\(-14\*t\)\':s=44100:d=0.2\[b\]\;anoisesrc=r=44100:d=0.2:c=brown:s=105:a=0.6\,highpass=f=75\,lowpass=f=850\,afade=t=out:st=0:d=0.18\[n\]\;\[b\]\[n\]amix=inputs=2:normalize=0 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.17500000000000002:d=0.025 -t 0.2 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/hurt.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 23 -i out/sfx/.work/hurt.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/hurt.wav -af volume=-3.1dB -t 0.2 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ hurt -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/hurt.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 23 -i out/sfx/hurt.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/hurt.ogg 
ffmpeg -v error -nostdin -i out/sfx/hurt.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i anoisesrc=r=44100:d=0.25:c=white:s=106:a=0.6\,bandpass=f=500:width_type=h:w=750\,afade=t=in:st=0:d=0.018\,afade=t=out:st=0.035:d=0.2\[l\]\;anoisesrc=r=44100:d=0.25:c=white:s=107:a=0.5\,bandpass=f=4200:width_type=h:w=4200\,afade=t=in:st=0:d=0.2\,afade=t=out:st=0.2:d=0.05\[h\]\;aevalsrc=exprs=\'0.13\*sin\(2\*PI\*\(140\*t+1700\*t\*t\)\)\*sin\(PI\*t/0.25\)\^2\':s=44100:d=0.25\[b\]\;\[l\]\[h\]\[b\]amix=inputs=3:normalize=0 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.225:d=0.025 -t 0.25 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/dash.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 19 -i out/sfx/.work/dash.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/dash.wav -af volume=1.3999999999999986dB -t 0.25 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ dash -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/dash.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 19 -i out/sfx/dash.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/dash.wav -af volume=1.8299999999999983dB -t 0.25 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ dash -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/dash.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 19 -i out/sfx/dash.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/dash.ogg 
ffmpeg -v error -nostdin -i out/sfx/dash.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i aevalsrc=exprs=\'if\(lt\(t\,0.14\)\,sin\(PI\*t/0.14\)\*\(0.55\*sin\(2\*PI\*659.255\*t\)+0.12\*sin\(2\*PI\*1318.51\*t\)\)\,sin\(PI\*\(t-0.14\)/0.16\)\*\(0.55\*sin\(2\*PI\*987.767\*\(t-0.14\)\)+0.12\*sin\(2\*PI\*1975.534\*\(t-0.14\)\)\)\)\':s=44100:d=0.3 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.27499999999999997:d=0.025 -t 0.3 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/pickup.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 15 -i out/sfx/.work/pickup.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/pickup.wav -af volume=-4.789999999999999dB -t 0.3 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ pickup -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/pickup.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 15 -i out/sfx/pickup.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/pickup.ogg 
ffmpeg -v error -nostdin -i out/sfx/pickup.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i aevalsrc=exprs=\'0.45\*sin\(2\*PI\*\(760\*t-1250\*t\*t\)\)\*exp\(-17\*t\)+if\(gte\(t\,0.105\)\,0.7\*sin\(2\*PI\*68\*\(t-0.105\)\)\*exp\(-35\*\(t-0.105\)\)\,0\)\':s=44100:d=0.2 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.17500000000000002:d=0.025 -t 0.2 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/drop.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 23 -i out/sfx/.work/drop.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/drop.wav -af volume=0.7600000000000016dB -t 0.2 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ drop -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/drop.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 23 -i out/sfx/drop.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/drop.wav -af volume=0.5500000000000007dB -t 0.2 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ drop -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/drop.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 23 -i out/sfx/drop.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/drop.ogg 
ffmpeg -v error -nostdin -i out/sfx/drop.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i aevalsrc=exprs=\'if\(lt\(t\,0.21\)\,\(1-exp\(-180\*t\)\)\*exp\(-8\*t\)\*\(0.5\*sin\(2\*PI\*523.251\*t\)+0.15\*sin\(2\*PI\*1046.502\*t\)\)\,if\(lt\(t\,0.42\)\,\(1-exp\(-180\*\(t-0.21\)\)\)\*exp\(-8\*\(t-0.21\)\)\*\(0.5\*sin\(2\*PI\*659.255\*\(t-0.21\)\)+0.15\*sin\(2\*PI\*1318.51\*\(t-0.21\)\)\)\,\(1-exp\(-180\*\(t-0.42\)\)\)\*exp\(-8\*\(t-0.42\)\)\*\(0.5\*sin\(2\*PI\*783.991\*\(t-0.42\)\)+0.15\*sin\(2\*PI\*1567.982\*\(t-0.42\)\)\)\)\)\':s=44100:d=0.7\,lowpass=f=6000 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.6749999999999999:d=0.025 -t 0.7 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/deliver.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 6 -i out/sfx/.work/deliver.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/deliver.wav -af volume=-0.46000000000000085dB -t 0.7 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ deliver -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/deliver.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 6 -i out/sfx/deliver.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/deliver.ogg 
ffmpeg -v error -nostdin -i out/sfx/deliver.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i anoisesrc=r=44100:d=0.8:c=white:s=108:a=0.24\,lowpass=f=3800\,afade=t=out:st=0:d=0.3\[n\]\;anoisesrc=r=44100:d=0.8:c=brown:s=109:a=0.3\,highpass=f=30\,lowpass=f=550\,afade=t=out:st=0.12:d=0.68\[r\]\;aevalsrc=exprs=\'0.17\*sin\(2\*PI\*\(36\*t+5\*\(1-exp\(-9\*t\)\)\)\)\*exp\(-1.5\*t\)+0.08\*sin\(2\*PI\*72\*t\)\*exp\(-1.5\*t\)+0.3\*sin\(2\*PI\*151\*t\)\*exp\(-t\)+0.09\*sin\(2\*PI\*223\*t\)\*exp\(-1.5\*t\)\':s=44100:d=0.8\,afade=t=out:st=0.42:d=0.38\[b\]\;\[n\]\[r\]\[b\]amix=inputs=3:normalize=0 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.775:d=0.025 -t 0.8 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/death.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 5 -i out/sfx/.work/death.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/death.wav -af volume=1.370000000000001dB -t 0.8 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ death -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/death.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 5 -i out/sfx/death.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/death.ogg 
ffmpeg -v error -nostdin -i out/sfx/death.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i aevalsrc=exprs=\'\(0.5\*sin\(2\*PI\*1480\*t\)+0.17\*sin\(2\*PI\*2317\*t\)\)\*exp\(-70\*t\)\':s=44100:d=0.08 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.0672:d=0.0128 -t 0.08 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/tick.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 59 -i out/sfx/.work/tick.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/tick.wav -af volume=1.8599999999999994dB -t 0.08 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ tick -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/tick.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 59 -i out/sfx/tick.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/tick.wav -af volume=1.1399999999999988dB -t 0.08 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ tick -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/tick.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 59 -i out/sfx/tick.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/tick.ogg 
ffmpeg -v error -nostdin -i out/sfx/tick.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i aevalsrc=exprs=\'if\(between\(t\,0.0\,0.3\)\,sin\(PI\*\(t-0.0\)/0.3\)\^0.7\*\(0.55\*sin\(2\*PI\*261.626\*\(t-0.0\)\)+0.1\*sin\(2\*PI\*523.252\*\(t-0.0\)\)\)\,0\)+if\(between\(t\,0.3\,0.6\)\,sin\(PI\*\(t-0.3\)/0.3\)\^0.7\*\(0.55\*sin\(2\*PI\*329.628\*\(t-0.3\)\)+0.1\*sin\(2\*PI\*659.256\*\(t-0.3\)\)\)\,0\)+if\(between\(t\,0.6\,0.9\)\,sin\(PI\*\(t-0.6\)/0.3\)\^0.7\*\(0.55\*sin\(2\*PI\*391.995\*\(t-0.6\)\)+0.1\*sin\(2\*PI\*783.99\*\(t-0.6\)\)\)\,0\)+if\(between\(t\,0.9\,1.2\)\,sin\(PI\*\(t-0.9\)/0.3\)\^0.7\*\(0.55\*sin\(2\*PI\*523.251\*\(t-0.9\)\)+0.1\*sin\(2\*PI\*1046.502\*\(t-0.9\)\)\)\,0\)\':s=44100:d=1.2 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=1.175:d=0.025 -t 1.2 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/win.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 3 -i out/sfx/.work/win.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/win.wav -af volume=-4.76dB -t 1.2 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ win -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/win.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 3 -i out/sfx/win.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/win.ogg 
ffmpeg -v error -nostdin -i out/sfx/win.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i aevalsrc=exprs=\'if\(between\(t\,0.0\,0.3\)\,sin\(PI\*\(t-0.0\)/0.3\)\^0.7\*\(0.55\*sin\(2\*PI\*440\*\(t-0.0\)\)+0.1\*sin\(2\*PI\*880\*\(t-0.0\)\)\)\,0\)+if\(between\(t\,0.3\,0.6\)\,sin\(PI\*\(t-0.3\)/0.3\)\^0.7\*\(0.55\*sin\(2\*PI\*349.228\*\(t-0.3\)\)+0.1\*sin\(2\*PI\*698.456\*\(t-0.3\)\)\)\,0\)+if\(between\(t\,0.6\,0.9\)\,sin\(PI\*\(t-0.6\)/0.3\)\^0.7\*\(0.55\*sin\(2\*PI\*293.665\*\(t-0.6\)\)+0.1\*sin\(2\*PI\*587.33\*\(t-0.6\)\)\)\,0\)+if\(between\(t\,0.9\,1.2\)\,sin\(PI\*\(t-0.9\)/0.3\)\^0.7\*\(0.55\*sin\(2\*PI\*220\*\(t-0.9\)\)+0.1\*sin\(2\*PI\*440\*\(t-0.9\)\)\)\,0\)\':s=44100:d=1.2\,lowpass=f=2400 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=1.175:d=0.025 -t 1.2 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/lose.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 3 -i out/sfx/.work/lose.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/lose.wav -af volume=-4.82dB -t 1.2 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ lose -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/lose.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 3 -i out/sfx/lose.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/lose.wav -af volume=-3.469999999999999dB -t 1.2 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ lose -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/lose.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 3 -i out/sfx/lose.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/lose.ogg 
ffmpeg -v error -nostdin -i out/sfx/lose.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i anoisesrc=r=44100:d=0.05:c=pink:s=110:a=0.3\,highpass=f=500\,lowpass=f=2600\,afade=t=out:st=0:d=0.035\[n\]\;aevalsrc=exprs=\'0.3\*sin\(2\*PI\*880\*t\)\*exp\(-105\*t\)\':s=44100:d=0.05\[b\]\;\[n\]\[b\]amix=inputs=2:normalize=0 -af afade=t=in:st=0:d=0.0004\,afade=t=out:st=0.042:d=0.008 -t 0.05 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/ui_click.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 95 -i out/sfx/.work/ui_click.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/ui_click.wav -af volume=7.949999999999999dB -t 0.05 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ ui_click -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/ui_click.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 95 -i out/sfx/ui_click.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/ui_click.wav -af volume=8.719999999999999dB -t 0.05 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ ui_click -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/ui_click.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 95 -i out/sfx/ui_click.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/ui_click.wav -af volume=9.129999999999999dB -t 0.05 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ ui_click -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/ui_click.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 95 -i out/sfx/ui_click.ogg -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/ui_click.ogg 
ffmpeg -v error -nostdin -i out/sfx/ui_click.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i aevalsrc=exprs=\'0.15\*sin\(2\*PI\*55\*t\)\^3\*\(0.8+0.2\*cos\(2\*PI\*t/32\)\)+0.065\*sin\(2\*PI\*82.5\*t+0.3\*sin\(2\*PI\*2\*t/32\)\)\^3+0.035\*sin\(2\*PI\*110\*t+0.6\*sin\(2\*PI\*3\*t/32\)\)\^3+0.022\*sin\(2\*PI\*116.59375\*t\)\^3\*\(0.7+0.3\*cos\(2\*PI\*2\*t/32\)\)+0.24\*sin\(2\*PI\*45\*t\)\^3\*exp\(-8\*\(1+cos\(2\*PI\*1.5\*t\)\)\)+0.045\*sin\(2\*PI\*90\*t\)\^3\*exp\(-6\*\(1+cos\(2\*PI\*1.5\*t\)\)\)+0.009000000\*sin\(2\*PI\*5536\*t/32+0.000000000\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+0.000000000\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.007964602\*sin\(2\*PI\*9612\*t/32+2.399963230\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+2.399963230\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.007142857\*sin\(2\*PI\*13688\*t/32+4.799926459\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+4.799926459\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.006474820\*sin\(2\*PI\*17764\*t/32+0.916704382\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+0.916704382\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.005921053\*sin\(2\*PI\*21839\*t/32+3.316667612\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+3.316667612\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.005454545\*sin\(2\*PI\*25915\*t/32+5.716630841\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+5.716630841\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.005056180\*sin\(2\*PI\*29991\*t/32+1.833408764\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+1.833408764\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.004712042\*sin\(2\*PI\*34067\*t/32+4.233371994\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+4.233371994\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.004411765\*sin\(2\*PI\*38143\*t/32+0.350149916\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+0.350149916\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.004147465\*sin\(2\*PI\*42219\*t/32+2.750113146\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+2.750113146\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.003913043\*sin\(2\*PI\*46294\*t/32+5.150076376\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+5.150076376\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.003703704\*sin\(2\*PI\*50370\*t/32+1.266854298\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+1.266854298\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.003515625\*sin\(2\*PI\*54446\*t/32+3.666817528\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+3.666817528\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.003345725\*sin\(2\*PI\*58522\*t/32+6.066780758\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+6.066780758\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.003191489\*sin\(2\*PI\*62598\*t/32+2.183558680\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+2.183558680\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.003050847\*sin\(2\*PI\*66674\*t/32+4.583521910\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+4.583521910\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002922078\*sin\(2\*PI\*7389\*t/32+0.700299833\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+0.700299833\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002803738\*sin\(2\*PI\*11465\*t/32+3.100263062\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+3.100263062\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002694611\*sin\(2\*PI\*15541\*t/32+5.500226292\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+5.500226292\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002593660\*sin\(2\*PI\*19617\*t/32+1.617004215\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+1.617004215\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002500000\*sin\(2\*PI\*23693\*t/32+4.016967444\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+4.016967444\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002412869\*sin\(2\*PI\*27769\*t/32+0.133745367\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+0.133745367\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002331606\*sin\(2\*PI\*31844\*t/32+2.533708597\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+2.533708597\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002255639\*sin\(2\*PI\*35920\*t/32+4.933671826\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+4.933671826\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002184466\*sin\(2\*PI\*39996\*t/32+1.050449749\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+1.050449749\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002117647\*sin\(2\*PI\*44072\*t/32+3.450412979\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+3.450412979\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.002054795\*sin\(2\*PI\*48148\*t/32+5.850376208\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+5.850376208\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.001995565\*sin\(2\*PI\*52224\*t/32+1.967154131\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+1.967154131\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.001939655\*sin\(2\*PI\*56300\*t/32+4.367117361\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+4.367117361\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.001886792\*sin\(2\*PI\*60375\*t/32+0.483895283\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+0.483895283\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.001836735\*sin\(2\*PI\*64451\*t/32+2.883858513\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+2.883858513\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.001789264\*sin\(2\*PI\*68527\*t/32+5.283821743\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+5.283821743\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.001744186\*sin\(2\*PI\*9243\*t/32+1.400599665\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+1.400599665\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.001701323\*sin\(2\*PI\*13319\*t/32+3.800562895\)\*\(0.65+0.35\*cos\(2\*PI\*1\*t/32+3.800562895\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.001660517\*sin\(2\*PI\*17395\*t/32+6.200526125\)\*\(0.65+0.35\*cos\(2\*PI\*2\*t/32+6.200526125\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2+0.001621622\*sin\(2\*PI\*21470\*t/32+2.317304047\)\*\(0.65+0.35\*cos\(2\*PI\*3\*t/32+2.317304047\)\)\*\(1-cos\(2\*PI\*t/32\)\)/2\':s=44100:d=32 -t 32 -ar 44100 -ac 1 -c:a pcm_f32le out/sfx/.work/music_loop.wav 
ffmpeg -hide_banner -nostdin -v info -stream_loop 0 -i out/sfx/.work/music_loop.wav -af loudnorm=I=-22:TP=-1:LRA=11:print_format=json -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/.work/music_loop.wav -af volume=2.129999999999999dB -t 32 -ar 44100 -ac 1 -c:a libvorbis -q:a 4 -map_metadata -1 -metadata title=NOT\ YOUR\ CARGO\ -\ music_loop -metadata comment=Original\ procedural\ ffmpeg\ synthesis\;\ project-owned out/sfx/music_loop.ogg 
ffmpeg -hide_banner -nostdin -v info -stream_loop 0 -i out/sfx/music_loop.ogg -af loudnorm=I=-22:TP=-1:LRA=11:print_format=json -f null - 
ffprobe -v error -show_entries stream=codec_name\,sample_rate\,channels:format=duration\,size -of json out/sfx/music_loop.ogg 
ffmpeg -v error -nostdin -i out/sfx/music_loop.ogg -f null - 
ffmpeg -hide_banner -nostdin -v error -y -i out/sfx/music_loop.ogg -ar 44100 -ac 1 -c:a pcm_f32le -f f32le out/sfx/.work/music-decoded.f32 
```

## Windows physical-directory checks

Commands executed from assets: `ls -la out/sfx`, `cmd /c "dir /AL out"`, `cmd /c "dir /AL out\sfx"`, and `cmd /c "fsutil reparsepoint query out\sfx"`. Native output follows (Windows code page). An empty `/AL` listing returns exit 1; fsutil error 4390 means the directory is **not** a reparse point.

```text

dir-parent.txt:
 Volume in drive C has no label.
 Volume Serial Number is 50FF-5A30

 Directory of C:\Users\Starlinecomp\Documents\Github Projects\Steppe Raiders\game\src\modules\not-your-cargo\assets\out

File Not Found

dir-contents.txt:
 Volume in drive C has no label.
 Volume Serial Number is 50FF-5A30

 Directory of C:\Users\Starlinecomp\Documents\Github Projects\Steppe Raiders\game\src\modules\not-your-cargo\assets\out\sfx

File Not Found

reparse.txt:
Error:  The file or directory is not a reparse point.

```
