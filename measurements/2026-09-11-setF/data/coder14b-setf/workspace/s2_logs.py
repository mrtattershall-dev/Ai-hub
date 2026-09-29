import sys
import re

def parse_line(line):
    # Example line: "2023-10-01 12:34:56,GET,/path,200"
    parts = line.split(',')
    if len(parts) != 4:
        return None
    timestamp, method, path, status = parts
    return {
        'timestamp': timestamp,
        'method': method,
        'path': path,
        'status': int(status)
    }

def parse_log(text):
    # Implement log parsing logic
    pass

def bad_lines(text):
    entries = parse_log(text)
    return [entry for entry in entries if entry['status'] >= 500]

def status_counts(entries):
    counts = {}
    for entry in entries:
        status = entry['status']
        if status in counts:
            counts[status] += 1
        else:
            counts[status] = 1
    return counts

def error_rate(entries):
    # Implement error rate logic
    pass

def top_paths(entries, n=3):
    path_counts = {}
    for entry in entries:
        path = entry['path']
        if path in path_counts:
            path_counts[path] += 1
        else:
            path_counts[path] = 1
    sorted_paths = sorted(path_counts.items(), key=lambda item: item[1], reverse=True)
    return sorted_paths[:n]

def main():
    if len(sys.argv) < 2:
        print("Usage: python s2_logs.py FILE [--top N]")
        sys.exit(1)

    file_path = sys.argv[1]
    top_n = 3

    if len(sys.argv) > 2 and sys.argv[2] == "--top":
        top_n = int(sys.argv[3])

    with open(file_path, 'r') as file:
        text = file.read()

    entries = parse_log(text)
    valid_lines = len(entries)
    errors = sum(1 for entry in entries if entry['status'] >= 500)
    top_paths_result = top_paths(entries, top_n)

    print(f"requests: {valid_lines}")
    print(f"errors: {errors}")
    for path, count in top_paths_result:
        print(f"{path} {count}")

if __name__ == "__main__":
    main()
def percentile(entries, p):
    # Implement percentile logic
    pass

def by_hour(entries, gap_minutes=30):
    # Implement by_hour logic
    pass

def between(entries, start, end):
    # Implement between logic
    pass

def sessions(entries, gap_minutes=30):
    # Implement sessions logic
    pass

def test_percentile():
    # Implement test_percentile logic
    pass

def test_by_hour():
    # Implement test_by_hour logic
    pass
def main():
    import sys
    import argparse

    parser = argparse.ArgumentParser(description='Process a log file.')
    parser.add_argument('file', type=str, help='The log file to process')
    parser.add_argument('--top', type=int, default=3, help='Number of top paths to display')

    args = parser.parse_args()

    with open(args.file, 'r') as f:
        text = f.read()

    entries = parse_log(text)
    bad = bad_lines(text)
    counts = status_counts(entries)
    top = top_paths(entries, args.top)

    print(f"requests: {len(entries)}")
    print(f"errors: {len(bad)}")
    for path, count in top:
        print(f"{path} {count}")

if __name__ == "__main__":
    main()
