"""Run the delivered inference code unchanged on local samples. No HTTP required."""
import os
os.environ.setdefault('MPLCONFIGDIR', '/private/tmp/ra-mpl')
import sys, json, time, platform, hashlib, math, resource
from pathlib import Path
from importlib.metadata import version
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import torch
from PIL import Image
from serve import RAScreeningService, build_model

def main():
    torch.set_num_threads(4)
    checkpoint = ROOT / 'model/ra_screening_model.pt'
    ckpt = torch.load(checkpoint, map_location='cpu', weights_only=True)
    model = build_model(ckpt['extra'])
    compatible = model.load_state_dict(ckpt['model'], strict=True)
    report = {
        'python': sys.version, 'platform': platform.platform(), 'device': 'cpu',
        'torch_threads': torch.get_num_threads(),
        'versions': {n: version(n) for n in ['torch','torchvision','torch-geometric','mediapipe','numpy','Pillow']},
        'checkpoint_sha256': hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
        'checkpoint_keys': list(ckpt), 'extra': ckpt['extra'],
        'state_dict_entries': len(ckpt['model']),
        'parameter_count': sum(p.numel() for p in model.parameters()),
        'missing_keys': compatible.missing_keys, 'unexpected_keys': compatible.unexpected_keys,
        'weights_finite': all(torch.isfinite(t).all().item() for t in ckpt['model'].values()),
        'samples': [],
    }
    del model, ckpt
    start = time.perf_counter()
    service = RAScreeningService.from_checkpoint(str(checkpoint), device='cpu')
    report['service_load_seconds'] = time.perf_counter()-start
    try:
        for path in sorted((ROOT/'test_images').glob('*.jpg')):
            with Image.open(path) as image:
                image = image.convert('RGB')
                start = time.perf_counter()
                result = service.predict_from_image(image).to_dict()
                elapsed = time.perf_counter()-start
            assert result['num_joints_detected'] == 11, (path,result)
            assert all(math.isfinite(j['probability']) and 0 <= j['probability'] <= 1 for j in result['joints'])
            assert result['ra_detected'] == (result['hand_probability'] >= service.thr_hand)
            assert result['num_positive_joints'] == sum(j['probability'] >= service.thr_node for j in result['joints'])
            record = {'image': path.name, 'seconds': elapsed, **result}
            report['samples'].append(record)
            print(json.dumps(record), flush=True)
        with Image.open(ROOT/'test_images/sample_001.jpg') as image:
            repeat = service.predict_from_image(image.convert('RGB')).to_dict()
        report['repeat_max_probability_difference'] = max(abs(a['probability']-b['probability']) for a,b in zip(report['samples'][0]['joints'],repeat['joints']))
        report['blank_image'] = service.predict_from_image(Image.new('RGB',(1600,1600),'white')).to_dict()
    finally:
        service.cropper.close()
    report['peak_rss_bytes_macos'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    out = ROOT/'validation/results.json'
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('Saved:',out,flush=True)

if __name__ == '__main__':
    main()
