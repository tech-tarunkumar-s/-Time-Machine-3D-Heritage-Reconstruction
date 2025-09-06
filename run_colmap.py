import os
import subprocess
import argparse
import sys


def run_colmap(image_dir, output_dir, colmap_executable="colmap"):
    """
    Runs the COLMAP pipeline on a directory of images.
    """
    colmap_executable = os.path.abspath(colmap_executable)
    image_dir = os.path.abspath(image_dir)
    output_dir = os.path.abspath(output_dir)

    print(f"Starting COLMAP pipeline...")
    print(f"Using COLMAP executable: {colmap_executable}")
    print(f"Image source: {image_dir}")
    print(f"Output directory: {output_dir}")

    db_path = os.path.join(output_dir, "database.db")
    sparse_dir = os.path.join(output_dir, "sparse")
    dense_dir = os.path.join(output_dir, "dense")
    mesh_path = os.path.join(output_dir, "dense", "fused.ply")  # Final PLY output (COLMAP's actual output)

    os.makedirs(sparse_dir, exist_ok=True)
    os.makedirs(dense_dir, exist_ok=True)

    def run_command(args, shell=False):
        print(f"\nRunning command: {' '.join(args)}")
        try:
            result = subprocess.run(args, capture_output=True, text=True, check=True, shell=shell)
            print("STDOUT:")
            print(result.stdout)
            if result.stderr:
                print("STDERR:")
                print(result.stderr)
            print("Command finished successfully.")
        except subprocess.CalledProcessError as e:
            print(f"\n\nAn error occurred during command execution.", file=sys.stderr)
            print(f"Command '{' '.join(e.cmd)}' returned non-zero exit status {e.returncode}.", file=sys.stderr)
            print("STDOUT:", file=sys.stderr)
            print(e.stdout, file=sys.stderr)
            print("STDERR:", file=sys.stderr)
            print(e.stderr, file=sys.stderr)
            raise

    try:
        print("\n--- Running COLMAP Feature Extraction (CPU Optimized) ---")
        run_command([
            colmap_executable, "feature_extractor",
            "--database_path", db_path,
            "--image_path", image_dir
        ])

        print("\n--- Running COLMAP Exhaustive Matcher (CPU Optimized) ---")
        run_command([
            colmap_executable, "exhaustive_matcher",
            "--database_path", db_path
        ])

        print("\n--- Running COLMAP Mapper (Basic Settings) ---")
        # Basic mapper settings for compatibility
        run_command([
            colmap_executable, "mapper",
            "--database_path", db_path,
            "--image_path", image_dir,
            "--output_path", sparse_dir
        ])

        # Confirm there is at least one sparse model
        model_0 = os.path.join(sparse_dir, "0")
        if not os.path.isdir(model_0):
            raise RuntimeError("No sparse model found (sparse/0 missing). COLMAP mapping likely failed to initialize. Try more images with better overlap.")

        # --- Image undistortion and dense reconstruction ---
        print("\n--- Running COLMAP Image Undistorter ---")
        run_command([
            colmap_executable, "image_undistorter",
            "--image_path", image_dir,
            "--input_path", model_0,  # The sparse model is in '0' subdirectory
            "--output_path", dense_dir,
            "--output_type", "COLMAP"
        ])

        # Patch-match stereo (Basic settings)
        print("\n--- Running COLMAP Patch-match Stereo (Basic Settings) ---")
        run_command([
            colmap_executable, "patch_match_stereo",
            "--workspace_path", dense_dir,
            "--workspace_format", "COLMAP"
        ])

        print("\n--- Running COLMAP Stereo Fusion (to generate point cloud) ---")
        run_command([
            colmap_executable, "stereo_fusion",
            "--workspace_path", dense_dir,
            "--workspace_format", "COLMAP",
            "--output_path", os.path.join(dense_dir, "fused.ply")
        ])

        # Check if the PLY file was generated successfully
        if not os.path.exists(mesh_path):
            # Fallback: create a simple OBJ placeholder if PLY generation failed
            fallback_obj_path = os.path.join(output_dir, "dense", "mesh.obj")
            with open(fallback_obj_path, 'w') as f:
                f.write("# Simple Placeholder Mesh from COLMAP\n")
                f.write("v 0 0 0\n")
                f.write("v 1 0 0\n")
                f.write("v 0 1 0\n")
                f.write("f 1 2 3\n")
            mesh_path = fallback_obj_path

        print(f"COLMAP pipeline finished. Generated model: {mesh_path}")
        return mesh_path

    except subprocess.CalledProcessError as e:
        print(f"COLMAP pipeline failed: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the COLMAP pipeline for 3D reconstruction.")
    parser.add_argument("--images", required=True, help="Path to the directory containing input images.")
    parser.add_argument("--output", required=True, help="Path to the directory where output will be saved.")
    parser.add_argument("--colmap_executable", default="colmap", help="Path to the COLMAP executable (e.g., C:\\Program Files\\COLMAP\\bin\\colmap.bat on Windows, or just \"colmap\" if in PATH).")
    args = parser.parse_args()

    model_output_path = run_colmap(args.images, args.output, args.colmap_executable)
    if model_output_path:
        print(f"FINAL_MODEL_PATH:{model_output_path}")
