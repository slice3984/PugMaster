<template>
  <teleport :to="relativeTo">
    <transition name="appear">
      <div v-if="show" class="toast-message" :class="`toast-message--${type}`">
        <div class="toast-message__icon">
          <base-icon
            width="4rem"
            height="4rem"
            fill="#fff"
            :icon="iconType"
          ></base-icon>
        </div>
        <div class="toast-message__content">
          <header><slot name="title">Title</slot></header>
          <p><slot>Description</slot></p>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";

export default defineComponent({
  props: {
    type: {
      type: String,
      required: true,
    },
    show: {
      type: Boolean,
      required: true,
    },
    relativeTo: {
      type: String,
      required: false,
      default: "body",
    },
  },
  setup(props) {
    const iconType = computed(() => {
      switch (props.type) {
        case "success":
          return "success";
        case "warn":
          return "warning";
        case "info":
          return "info";
      }
    });

    return {
      iconType,
    };
  },
});
</script>

<style lang="scss" scoped>
.toast-message {
  position: absolute;
  background-color: $dark;
  display: flex;
  align-items: center;
  top: 1rem;
  right: 1rem;
  box-shadow: 5px 5px 2px 0px rgba(0, 0, 0, 0.1);
  font-family: "Roboto", sans-serif;

  &__icon {
    padding: 0.5rem 1rem;
  }

  &__content {
    color: $white;
    padding: 0 1rem;

    & header {
      font-size: 2rem;
      font-weight: 400;
    }

    & p {
      font-size: 1.5rem;
      font-weight: 300;
    }
  }

  &--warn {
    & div:first-of-type {
      background-color: $orange;
    }
  }

  &--info {
    & div:first-of-type {
      background-color: $blue;
    }
  }

  &--success {
    & div:first-of-type {
      background-color: $dark-green;
    }
  }

  @keyframes appear {
    from {
      opacity: 0;
      transform: translateY(-3rem);
    }
    to {
      opacity: 1;
      transform: translateY(3rem);
    }
  }
}

.appear-enter-active {
  transition: all 300ms ease-out;
}

.appear-leave-active {
  transition: all 500ms cubic-bezier(1, 0.5, 0.8, 1);
}

.appear-enter-from,
.appear-leave-to {
  opacity: 0;
}
</style>