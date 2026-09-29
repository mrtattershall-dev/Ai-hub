import subprocess
import sys

# Run the test file
result = subprocess.run([sys.executable, 'test_s3_matrix.js'], capture_output=True, text=True)
print("STDOUT:")
print(result.stdout)
print("STDERR:")
print(result.stderr)
print("Return code:", result.returncode)