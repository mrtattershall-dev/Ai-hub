import subprocess
import sys

# Run the test file to verify our changes work
try:
    result = subprocess.run([sys.executable, 'test_cart.js'], capture_output=True, text=True, check=True)
    print("Test output:")
    print(result.stdout)
    if result.stderr:
        print("Test errors:")
        print(result.stderr)
except subprocess.CalledProcessError as e:
    print(f"Test failed with return code {e.returncode}")
    print("STDOUT:", e.stdout)
    print("STDERR:", e.stderr)