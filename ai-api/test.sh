python - <<'PY'
from serve import require_checkpoint_file
import torch

try:
    require_checkpoint_file("model/ra_screening_model.pt")
    torch.load("model/ra_screening_model.pt", map_location="cpu")
    print("モデル読み込み成功")
except Exception as error:
    print(type(error).__name__ + ":", error)
    raise SystemExit(1)
PY
