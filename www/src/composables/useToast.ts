import { ref } from "vue"

export const useToast = () => {
    const toastType = ref('');
    const toastTitle = ref('');
    const toastContent = ref('');
    const toastDisplayed = ref(false);

    const createToast = (type: 'info' | 'warn' | 'success',
        title: string, content: string, timeInMs: number) => {
        toastType.value = type;
        toastTitle.value = title;
        toastContent.value = content;
        toastDisplayed.value = true;

        setTimeout(() => toastDisplayed.value = false, timeInMs);
    }

    return {
        toastType,
        toastTitle,
        toastContent,
        toastDisplayed,
        createToast
    }
}