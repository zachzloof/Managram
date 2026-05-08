import { ref } from 'vue';

const pendingFile = ref(null);

export function usePendingCompose() {
  function setPendingFile(file) {
    pendingFile.value = file;
  }
  function takePendingFile() {
    const file = pendingFile.value;
    pendingFile.value = null;
    return file;
  }
  return { setPendingFile, takePendingFile };
}
