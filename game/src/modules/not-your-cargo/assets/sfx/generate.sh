#!/usr/bin/env bash
# Run from the assets directory: bash out/sfx/generate.sh
# Original procedural audio only. All generated media stays under out/.
set -euo pipefail
export LC_ALL=C
DEST=out/sfx
WORK="$DEST/.work"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT
: > "$WORK/commands.txt"
: > "$WORK/manifest.tsv"
run() {
    printf '%q ' "$@" >> "$WORK/commands.txt"
    printf '\n' >> "$WORK/commands.txt"
    "$@"
}
measure() {
    local file=$1 loops=$2 target=$3 log=$4
    run ffmpeg -hide_banner -nostdin -v info -stream_loop "$loops" -i "$file" \
        -af "loudnorm=I=$target:TP=-1:LRA=11:print_format=json" -f null - 2> "$log"
}
# Static measured gain preserves attacks and the drone's exact periodic envelope.
# Clips are repeated to >=4.8 seconds for EBU R128 analysis (no silence padding).
render() {
    local name=$1 dur=$2 target=$3 graph=$4 description=$5
    local loops gain fade_start fade_time
    loops=$(python -c "import math; print(max(0, math.ceil(4.8/$dur)-1))")
    echo "Synthesizing $name ($dur s)"
    if [[ $name == music_loop ]]; then
        run ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i "$graph" \
            -t "$dur" -ar 44100 -ac 1 -c:a pcm_f32le "$WORK/$name.wav"
    else
        fade_time=$(python -c "print(min(0.025, $dur*0.16))")
        fade_start=$(python -c "print($dur-$fade_time)")
        run ffmpeg -hide_banner -nostdin -v error -y -f lavfi -i "$graph" \
            -af "afade=t=in:st=0:d=0.0004,afade=t=out:st=$fade_start:d=$fade_time" \
            -t "$dur" -ar 44100 -ac 1 -c:a pcm_f32le "$WORK/$name.wav"
    fi
    measure "$WORK/$name.wav" "$loops" "$target" "$WORK/input.json"
    gain=$(python - "$WORK/input.json" "$target" <<'PY'
import json,sys
s=open(sys.argv[1]).read(); j=json.JSONDecoder().raw_decode(s[s.rfind('{'):])[0]
print(min(float(sys.argv[2])-float(j['input_i']), -1.8-float(j['input_tp'])))
PY
)
    # Correct for any codec/loop-demux measurement offset, always from the WAV.
    local attempt correction
    for attempt in 1 2 3; do
        run ffmpeg -hide_banner -nostdin -v error -y -i "$WORK/$name.wav" \
            -af "volume=${gain}dB" -t "$dur" -ar 44100 -ac 1 -c:a libvorbis -q:a 4 \
            -map_metadata -1 -metadata "title=NOT YOUR CARGO - $name" \
            -metadata 'comment=Original procedural ffmpeg synthesis; project-owned' "$DEST/$name.ogg"
        measure "$DEST/$name.ogg" "$loops" "$target" "$WORK/final.json"
        correction=$(python - "$WORK/final.json" "$target" <<'PY'
import json,sys
s=open(sys.argv[1]).read(); j=json.JSONDecoder().raw_decode(s[s.rfind('{'):])[0]
delta=float(sys.argv[2])-float(j['input_i'])
print(0 if abs(delta)<0.2 else min(delta,-1.5-float(j['input_tp'])))
PY
)
        [[ $correction == 0 ]] && break
        gain=$(python -c "print($gain+$correction)")
    done
    run ffprobe -v error -show_entries stream=codec_name,sample_rate,channels:format=duration,size \
        -of json "$DEST/$name.ogg" > "$WORK/probe.json"
    run ffmpeg -v error -nostdin -i "$DEST/$name.ogg" -f null -
    python - "$WORK/probe.json" "$WORK/final.json" "$name" "$dur" "$target" "$description" >> "$WORK/manifest.tsv" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); s=open(sys.argv[2]).read(); m=json.JSONDecoder().raw_decode(s[s.rfind('{'):])[0]
a=p['streams'][0]; duration=float(p['format']['duration']); target=float(sys.argv[5])
assert a['codec_name']=='vorbis' and int(a['sample_rate'])==44100 and a['channels']==1, p
assert abs(duration-float(sys.argv[4]))<0.002, p
assert abs(float(m['input_i'])-target)<1.0, m
assert float(m['input_tp'])<=-0.5, m
print('\t'.join([sys.argv[3]+'.ogg',f'{duration:.3f}',m['input_i'],m['input_tp'],p['format']['size'],sys.argv[6]]))
PY
}

render shot_mg 0.08 -16 "anoisesrc=r=44100:d=0.08:c=white:s=101:a=0.55,highpass=f=550,lowpass=f=9200,afade=t=out:st=0:d=0.068[n];aevalsrc=exprs='0.8*sin(2*PI*(65*t+3.5*(1-exp(-75*t))))*exp(-65*t)':s=44100:d=0.08[b];[n][b]amix=inputs=2:normalize=0" 'Sharp dry noise crack with a descending low mechanical thump.'
render shot_shotgun 0.25 -16 "anoisesrc=r=44100:d=0.25:c=white:s=102:a=0.8,highpass=f=180,lowpass=f=6500,afade=t=out:st=0:d=0.24[n];aevalsrc=exprs='1.1*sin(2*PI*(43*t+7*(1-exp(-32*t))))*exp(-19*t)+0.22*sin(2*PI*123*t)*exp(-32*t)':s=44100:d=0.25[b];[n][b]amix=inputs=2:normalize=0" 'Heavy close-range boom with a gritty debris/noise tail.'
render shot_enemy 0.1 -16 "anoisesrc=r=44100:d=0.1:c=white:s=103:a=0.55,highpass=f=1700,lowpass=f=10000,afade=t=out:st=0:d=0.09[n];aevalsrc=exprs='0.27*sin(2*PI*(380*t+4*(1-exp(-65*t))))*exp(-42*t)':s=44100:d=0.1[b];[n][b]amix=inputs=2:normalize=0" 'Thin high raider shot, distinct from the courier weapons.'
render hit 0.12 -16 "aevalsrc=exprs='(0.55*sin(2*PI*763*t)+0.3*sin(2*PI*1289*t)+0.2*sin(2*PI*2117*t)+0.15*sin(2*PI*3461*t))*exp(-27*t)':s=44100:d=0.12[m];anoisesrc=r=44100:d=0.12:c=white:s=104:a=0.3,bandpass=f=2700:width_type=h:w=2600,afade=t=out:st=0:d=0.024[n];[m][n]amix=inputs=2:normalize=0" 'Short inharmonic sheet-metal clank and impact grit.'
render hurt 0.2 -16 "aevalsrc=exprs='0.85*sin(2*PI*(58*t+1.5*(1-exp(-35*t))))*exp(-16*t)+0.25*sin(2*PI*91*t)*exp(-14*t)':s=44100:d=0.2[b];anoisesrc=r=44100:d=0.2:c=brown:s=105:a=0.6,highpass=f=75,lowpass=f=850,afade=t=out:st=0:d=0.18[n];[b][n]amix=inputs=2:normalize=0" 'Dull body/chassis thud with a low damaged-power tone.'
render dash 0.25 -16 "anoisesrc=r=44100:d=0.25:c=white:s=106:a=0.6,bandpass=f=500:width_type=h:w=750,afade=t=in:st=0:d=0.018,afade=t=out:st=0.035:d=0.2[l];anoisesrc=r=44100:d=0.25:c=white:s=107:a=0.5,bandpass=f=4200:width_type=h:w=4200,afade=t=in:st=0:d=0.2,afade=t=out:st=0.2:d=0.05[h];aevalsrc=exprs='0.13*sin(2*PI*(140*t+1700*t*t))*sin(PI*t/0.25)^2':s=44100:d=0.25[b];[l][h][b]amix=inputs=3:normalize=0" 'Low-to-high crossfiltered thruster whoosh with a rising motor chirp.'
render pickup 0.3 -16 "aevalsrc=exprs='if(lt(t,0.14),sin(PI*t/0.14)*(0.55*sin(2*PI*659.255*t)+0.12*sin(2*PI*1318.51*t)),sin(PI*(t-0.14)/0.16)*(0.55*sin(2*PI*987.767*(t-0.14))+0.12*sin(2*PI*1975.534*(t-0.14))))':s=44100:d=0.3" 'Two rounded rising cargo-confirmation blips, E5 to B5.'
render drop 0.2 -16 "aevalsrc=exprs='0.45*sin(2*PI*(760*t-1250*t*t))*exp(-17*t)+if(gte(t,0.105),0.7*sin(2*PI*68*(t-0.105))*exp(-35*(t-0.105)),0)':s=44100:d=0.2" 'Falling cargo blip followed by a low landing thud.'
render deliver 0.7 -16 "aevalsrc=exprs='if(lt(t,0.21),(1-exp(-180*t))*exp(-8*t)*(0.5*sin(2*PI*523.251*t)+0.15*sin(2*PI*1046.502*t)),if(lt(t,0.42),(1-exp(-180*(t-0.21)))*exp(-8*(t-0.21))*(0.5*sin(2*PI*659.255*(t-0.21))+0.15*sin(2*PI*1318.51*(t-0.21))),(1-exp(-180*(t-0.42)))*exp(-8*(t-0.42))*(0.5*sin(2*PI*783.991*(t-0.42))+0.15*sin(2*PI*1567.982*(t-0.42)))))':s=44100:d=0.7,lowpass=f=6000" 'Bright three-note rising delivery arpeggio, C5 E5 G5.'
render death 0.8 -16 "anoisesrc=r=44100:d=0.8:c=white:s=108:a=0.24,lowpass=f=3800,afade=t=out:st=0:d=0.3[n];anoisesrc=r=44100:d=0.8:c=brown:s=109:a=0.3,highpass=f=30,lowpass=f=550,afade=t=out:st=0.12:d=0.68[r];aevalsrc=exprs='0.17*sin(2*PI*(36*t+5*(1-exp(-9*t))))*exp(-1.5*t)+0.08*sin(2*PI*72*t)*exp(-1.5*t)+0.3*sin(2*PI*151*t)*exp(-t)+0.09*sin(2*PI*223*t)*exp(-1.5*t)':s=44100:d=0.8,afade=t=out:st=0.42:d=0.38[b];[n][r][b]amix=inputs=3:normalize=0" 'Destruction crack followed by a long collapsing engine rumble.'
render tick 0.08 -16 "aevalsrc=exprs='(0.5*sin(2*PI*1480*t)+0.17*sin(2*PI*2317*t))*exp(-70*t)':s=44100:d=0.08" 'Dry precise metallic counter tick.'

# Local-time envelopes reach zero at each note boundary, avoiding hard note cuts.
# Python only constructs lavfi expression text; ffmpeg generates every sample.
jingle() {
    python - "$1" <<'PY'
import sys
freqs=[261.626,329.628,391.995,523.251] if sys.argv[1]=='win' else [440,349.228,293.665,220]
terms=[]
for i,f in enumerate(freqs):
    start=i*0.3; u=f'(t-{start:.1f})'
    tone=f'(0.55*sin(2*PI*{f}*{u})+0.1*sin(2*PI*{2*f}*{u}))'
    terms.append(f'if(between(t,{start:.1f},{start+0.3:.1f}),sin(PI*{u}/0.3)^0.7*{tone},0)')
print('+'.join(terms))
PY
}
render win 1.2 -16 "aevalsrc=exprs='$(jingle win)':s=44100:d=1.2" 'Four-note major success jingle, C4 E4 G4 C5.'
render lose 1.2 -16 "aevalsrc=exprs='$(jingle lose)':s=44100:d=1.2,lowpass=f=2400" 'Descending D-minor-coloured failure motif, A4 F4 D4 A3.'
render ui_click 0.05 -16 "anoisesrc=r=44100:d=0.05:c=pink:s=110:a=0.3,highpass=f=500,lowpass=f=2600,afade=t=out:st=0:d=0.035[n];aevalsrc=exprs='0.3*sin(2*PI*880*t)*exp(-105*t)':s=44100:d=0.05[b];[n][b]amix=inputs=2:normalize=0" 'Soft rounded console click without a harsh high-frequency snap.'

# Every oscillator and modulator completes an integer number of cycles in 32 s.
# No fade, stochastic source, echo, or filter startup transient on the loop.
# 1.5 Hz pulse = 90 BPM; exactly 48 beats. Texture is a periodic sine bank.
MUSIC=$(python - <<'PY'
import math
parts=[
 '0.15*sin(2*PI*55*t)^3*(0.8+0.2*cos(2*PI*t/32))',
 '0.065*sin(2*PI*82.5*t+0.3*sin(2*PI*2*t/32))^3',
 '0.035*sin(2*PI*110*t+0.6*sin(2*PI*3*t/32))^3',
 '0.022*sin(2*PI*116.59375*t)^3*(0.7+0.3*cos(2*PI*2*t/32))',
 '0.24*sin(2*PI*45*t)^3*exp(-8*(1+cos(2*PI*1.5*t)))',
 '0.045*sin(2*PI*90*t)^3*exp(-6*(1+cos(2*PI*1.5*t)))'
]
for i in range(36):
    cycles=round(32*(173+(i*127.37)%1980))
    amp=0.009/(1+i*0.13)
    phase=(i*2.399963229728653)%(2*math.pi)
    parts.append(f'{amp:.9f}*sin(2*PI*{cycles}*t/32+{phase:.9f})*(0.65+0.35*cos(2*PI*{1+i%3}*t/32+{phase:.9f}))*(1-cos(2*PI*t/32))/2')
print('+'.join(parts))
PY
)
render music_loop 32 -22 "aevalsrc=exprs='$MUSIC':s=44100:d=32" 'Seamless dark desert drone, gritty wind-like sine-bank texture and 90 BPM low pulse.'

# Decode loop to floating point for boundary/peak checks; this is not source audio.
run ffmpeg -hide_banner -nostdin -v error -y -i "$DEST/music_loop.ogg" \
    -ar 44100 -ac 1 -c:a pcm_f32le -f f32le "$WORK/music-decoded.f32"
python - "$DEST" "$WORK" <<'PY'
import array,math,pathlib,sys
root=pathlib.Path(sys.argv[1]); work=pathlib.Path(sys.argv[2])
rows=[line.split('\t') for line in (work/'manifest.tsv').read_text().splitlines()]
assert len(rows)==15 and len(list(root.glob('*.ogg')))==15
music=next(r for r in rows if r[0]=='music_loop.ogg')
sfx_bytes=sum(int(r[4]) for r in rows if r[0]!='music_loop.ogg')
assert int(music[4])<350000, music
assert sfx_bytes<600000, sfx_bytes
assert sfx_bytes+int(music[4])<600000
samples=array.array('f'); samples.frombytes((work/'music-decoded.f32').read_bytes())
if sys.byteorder!='little': samples.byteswap()
assert len(samples)==32*44100, len(samples)
jump=abs(samples[0]-samples[-1])
diffs=[abs(samples[i]-samples[i-1]) for i in range(1,len(samples))]
rms_step=math.sqrt(sum(v*v for v in diffs)/len(diffs))
assert jump<0.005 and jump<5*rms_step, (jump,rms_step)
text='''# NOT YOUR CARGO — original procedural audio

Synthesized procedurally with ffmpeg (see generate.sh); no third-party audio; licence: project-owned.

## Rebuild

From the assets directory, run `bash out/sfx/generate.sh`. Requires Bash, Python 3 (`python`), ffmpeg with libvorbis, and ffprobe. All synthesis commands are in the generator; the exact expanded commands from this run are recorded below. Fixed noise seeds make the synthesis repeatable. Existing source media is never read or changed.

**Packaging exception:** higher-priority editor instructions require generated media under `out/`, so this normal, physical package is `out/sfx/`, not the requested direct `sfx/`. No symlinks or junctions are created. The script replaces only its own generated outputs and removes its temporary `.work` directory when it exits.

## Files and verification

Every file is mono, 44100 Hz, OGG Vorbis encoded with `libvorbis -q:a 4`. Each passed individual ffprobe codec/channel/rate/duration assertions and a complete `ffmpeg -v error -i FILE -f null -` decode. Duration tolerance: 2 ms. Loudness is measured from the final Vorbis decode, using loudnorm's input measurements. Short effects are repeated without silence to at least 4.8 seconds for meaningful integrated LUFS; standalone effects shorter than 400 ms cannot yield a standard integrated reading. Gain is static, measured using loudnorm, with initial 1.8 dB pre-encode true-peak headroom and up to three codec-aware gain passes. All measured levels are within 1 LU of their target and final true peaks below -0.5 dBTP.

| File | Duration (s) | LUFS-I | True peak (dBTP) | Bytes | Design |
|---|---:|---:|---:|---:|---|
'''
for r in rows:
    text+='| '+' | '.join(r)+' |\n'
text+=f'\n14 SFX: **{sfx_bytes:,} bytes** (<600 KB). Music: **{int(music[4]):,} bytes** (<350 KB). All 15 OGGs combined: **{sfx_bytes+int(music[4]):,} bytes** (<600 KB). Limits use decimal KB.\n'
text+=f'''
## Music loop

32.000 seconds, exactly 1,411,200 decoded samples and 48 pulses at 90 BPM. All source oscillators and modulators are integer-cycle periodic across 32 seconds. No non-periodic noise, startup filters, global fade, or reverb tail is used. The decoded boundary step is {jump:.8f} full scale ({20*math.log10(max(jump,1e-20)):.2f} dBFS); ordinary adjacent-sample RMS step is {rms_step:.8f}. The boundary passed the numerical continuity threshold (<0.005 full scale and <5 times RMS step). Use gapless playback of the entire file, with no playback padding. Actual game-engine gapless playback and subjective listening were not tested.

The ambient texture is a deterministic inharmonic sine bank, not sampled wind. UI and success tones are original motifs, not recreated recordings.

## Exact executed audio commands

Paths under `.work` are temporary and removed after verification. LUFS analysis repeats are explicitly shown as `-stream_loop N`. Synthesis input strings below are shell-escaped by Bash (`printf %q`); they can be copied into Bash.

```bash
'''
text+=(work/'commands.txt').read_text()
text+='```\n'
(root/'README.md').write_text(text,encoding='utf-8')
print(f'PASS: 15 Vorbis files; SFX {sfx_bytes} B; music {music[4]} B; loop boundary {jump:.8f}.')
PY
# Directory inspection required by the delivery request, adapted to out/sfx.
run ls -la "$DEST"
if command -v cmd >/dev/null 2>&1; then
    # MSYS_NO_PATHCONV prevents Git Bash rewriting /c and /AL.
    # `dir /AL` returns 1 when no reparse points exist: expected, not a failure.
    MSYS_NO_PATHCONV=1 cmd /c 'dir /AL out' > "$WORK/dir-parent.txt" 2>&1 || true
    MSYS_NO_PATHCONV=1 cmd /c 'dir /AL out\sfx' > "$WORK/dir-contents.txt" 2>&1 || true
    MSYS_NO_PATHCONV=1 cmd /c 'fsutil reparsepoint query out\sfx' > "$WORK/reparse.txt" 2>&1 || true
    python - "$DEST/README.md" "$WORK" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1]); w=pathlib.Path(sys.argv[2])
with p.open('a',encoding='utf-8') as f:
    f.write('\n## Windows physical-directory checks\n\nCommands executed from assets: `ls -la out/sfx`, `cmd /c "dir /AL out"`, `cmd /c "dir /AL out\\sfx"`, and `cmd /c "fsutil reparsepoint query out\\sfx"`. Native output follows (Windows code page). An empty `/AL` listing returns exit 1; fsutil error 4390 means the directory is **not** a reparse point.\n\n```text\n')
    for name in ['dir-parent.txt','dir-contents.txt','reparse.txt']:
        f.write('\n'+name+':\n'+(w/name).read_bytes().decode('cp866',errors='replace'))
    f.write('\n```\n')
PY
    cat "$WORK/reparse.txt"
fi
printf 'Finished. Package: %s (15 OGG + generate.sh + README.md).\n' "$DEST"
