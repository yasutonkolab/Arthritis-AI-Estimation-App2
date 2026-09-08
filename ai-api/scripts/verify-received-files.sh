#!/usr/bin/env bash
set -euo pipefail

expected_model=1a08b670b9c601856ed661dddba6b1bfcff3998bb39cdf584dcd42677bd689ec
expected_serve=4e314770d9ffc518957a41d38ecf6e2913fb6ee53b5c365e55559282cd88c2c7
expected_requirements=d4c21822142bb666021329ae22fbfa2bf7e2a366fa2d9ee32d9962e187db2514

if [[ ! -f model/ra_screening_model.pt ]]; then
  echo "model/ra_screening_model.pt is missing. This weight file is not stored in git; place the delivered checkpoint at that path before verifying or deploying." >&2
  exit 1
fi

actual_model=$(shasum -a 256 model/ra_screening_model.pt | awk '{print $1}')
actual_serve=$(shasum -a 256 serve.py | awk '{print $1}')
actual_requirements=$(shasum -a 256 requirements.txt | awk '{print $1}')

[[ "$actual_model" == "$expected_model" ]]
[[ "$actual_serve" == "$expected_serve" ]]
[[ "$actual_requirements" == "$expected_requirements" ]]
echo "Received files are unchanged."
