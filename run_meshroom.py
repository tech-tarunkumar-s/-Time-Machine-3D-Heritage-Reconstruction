import os
import subprocess
import argparse
import sys

def run_meshroom(image_dir, output_dir, meshroom_executable):
    """
    Runs the Meshroom pipeline on a directory of images.
    """
    # --- Convert all paths to absolute paths ---
    meshroom_executable = os.path.abspath(meshroom_executable)
    image_dir = os.path.abspath(image_dir)
    output_dir = os.path.abspath(output_dir)

    print(f"Starting Meshroom pipeline...")
    print(f"Using Meshroom executable: {meshroom_executable}")
    print(f"Image source: {image_dir}")
    print(f"Output directory: {output_dir}")

    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # The output path for the final model
    output_model_path = os.path.join(output_dir, "texturedMesh.obj")

    # --- Helper function to run a command and print output ---
    def run_command(command, log_file):
        """Executes a command and saves its output to a log file."""
        print(f"Redirecting output to {log_file}")
        try:
            # Use subprocess.run for a simpler, more robust execution.
            # It waits for the command to complete and captures output.
            result = subprocess.run(command, capture_output=True, text=True, shell=True, check=False)

            # Write output to log file
            with open(log_file, 'w') as f:
                f.write(result.stdout)
                f.write(result.stderr)

            # Print output to console
            print(result.stdout)
            print(result.stderr, file=sys.stderr)

            # Raise an exception if the command failed
            if result.returncode != 0:
                raise subprocess.CalledProcessError(result.returncode, command, output=result.stdout, stderr=result.stderr)

        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            raise

    try:
        # Construct the command as a list of arguments.
        pipeline_path = os.path.join(os.path.dirname(meshroom_executable), 'aliceVision', 'share', 'meshroom', 'photogrammetry.mg')

        # Using shell=True, so we build a single command string.
        # Paths with spaces must be quoted.
        # Normalize path for better compatibility, especially with shell commands.
        normalized_image_dir = image_dir.replace('\\', '/')
        
        # Running just the CameraInit step to diagnose the issue
        command_str = (
            f'"{meshroom_executable}" '  # Quote the executable path
            f'--pipeline "{pipeline_path}" '
            f'--input "{normalized_image_dir}" '
            f'--output "{output_dir}" '
            '--steps CameraInit '  # Only run CameraInit step
            '--forceCompute '
            '--verboseLevel info'  # Enable verbose output
        )
        print(f"Running command: {command_str}")

        log_file = os.path.join(output_dir, "meshroom_log.txt")
        run_command(command_str, log_file)

        print(f"\nMeshroom pipeline finished.")
        
        print(f"Final model saved to: {output_model_path}")

    except subprocess.CalledProcessError as e:
        print(f"\n\nAn error occurred during the Meshroom pipeline.")
        print(f"Command returned non-zero exit status {e.returncode}. Check '{os.path.join(output_dir, 'meshroom_log.txt')}' for details.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Meshroom pipeline for 3D reconstruction.")
    parser.add_argument("--images", required=True, help="Path to the directory containing input images.")
    parser.add_argument("--output", required=True, help="Path to the directory where output will be saved.")
    parser.add_argument("--meshroom_executable", required=True, help="Path to the meshroom_batch executable (e.g., D:\\Meshroom\\meshroom_batch.exe).")
    args = parser.parse_args()

    run_meshroom(args.images, args.output, args.meshroom_executable)
