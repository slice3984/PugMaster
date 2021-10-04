<template>
  <div class="command" v-if="commandInfo">
    <div class="command__info">
      <header>
        <h1>Info</h1>
      </header>
      <div class="command__values">
        <div class="command__value">
          <div>Command</div>
          <div>{{ commandInfo.cmd }}</div>
        </div>
        <div class="command__value" v-if="commandInfo.aliases">
          <div>Aliases</div>
          <div>{{ commandInfo.aliases.join(", ") }}</div>
        </div>
        <div class="command__value" v-if="commandInfo.cooldown">
          <div>Cooldown</div>
          <div>{{ commandInfo.cooldown }} seconds</div>
        </div>
        <div class="command__value">
          <div>Description</div>
          <div>{{ commandInfo.desc }}</div>
        </div>
        <div class="command__value">
          <div>Permissions</div>
          <div>{{ commandInfo.perms ? "Required" : "Not required" }}</div>
        </div>
        <div class="command__value">
          <div>Scope</div>
          <div>
            {{
              commandInfo.global ? "Listen / Pickup channel" : "Pickup channel"
            }}
          </div>
        </div>
        <div class="command__value">
          <div>Usage</div>
          <div>{{ generateUsageString(commandInfo) }}</div>
        </div>
      </div>
    </div>
    <div class="command__args" v-if="commandInfo.args">
      <header><h1>Arguments</h1></header>
      <table>
        <thead>
          <th>Name</th>
          <th>Description</th>
          <th>Required</th>
        </thead>
        <tbody>
          <tr v-for="arg in commandInfo.args" :key="arg">
            <td>{{ arg.name }}</td>
            <td>{{ transformArgumentType(arg.desc) }}</td>
            <td>{{ arg.required ? "Yes" : "Optional" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="command__defaults" v-if="commandInfo.defaults">
      <header><h1>Defaults</h1></header>
      <table>
        <thead>
          <th>Name</th>
          <th>Description</th>
          <th>Type</th>
          <th>Default</th>
          <th>Valid values</th>
        </thead>
        <tbody>
          <tr v-for="def in commandInfo.defaults" :key="def">
            <td>{{ def.name }}</td>
            <td>{{ def.desc }}</td>
            <td>{{ def.type }}</td>
            <td>{{ transformDefaultValue(def.type, def.value) }}</td>
            <td>{{ transformDefaultRange(def.type, def.possibleValues) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
        <div class="command__info" v-if="commandInfo.additionalInfo">
          <header><h1>Additional information</h1></header>
          <p v-html="commandInfo.additionalInfo.replace('\n', '<br />')"></p>
        </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { CommandInfo } from "@/store/types";
import Util from "@/util";

export default defineComponent({
  props: {
    commandInfo: {
      type: Object as () => CommandInfo,
      required: true,
    },
  },
  setup(props) {
    const generateUsageString = (command: CommandInfo) =>
      `!${command.cmd} ${
        command.args ? command.args.map((arg) => arg.name).join(" ") : ""
      }`;

    const transformArgumentType = (type) => {
      switch (type) {
        case "ping":
          return "User supplied as ping or user id";
        case "time":
          return "Time given as 1m 2h 3d 4w - minutes, hours, days, weeks";
        case "time-short":
          return "Time given as 1m 2h 3d - minutes, hours, days";
        default:
          return type;
      }
    };

    const transformDefaultValue = (
      type: "string" | "number" | "time",
      value: "string" | "number"
    ) => {
      if (["string", "number"].includes(type)) {
        return value;
      } else {
        return Util.formatTime(value);
      }
    };

    const transformDefaultRange = (
      type: "string" | "number" | "time",
      possibleValues: number[] | string[] | { from: number; to: number }
    ) => {
      if (type === "string") {
        return (possibleValues as string[]).join(", ");
      } else if (type === "number") {
        const range = possibleValues as { from: number; to: number };
        return `${range.from} to ${range.to}`;
      } else {
        const range = possibleValues as { from: number; to: number };
        return `${Util.formatTime(range.from)} to ${Util.formatTime(range.to)}`;
      }
    };
    const commandInfo = computed(() => props.commandInfo);

    return {
      commandInfo,
      generateUsageString,
      transformDefaultValue,
      transformDefaultRange,
      transformArgumentType,
    };
  },
});
</script>

<style lang="scss" scoped>
.command {
  header {
    text-align: left;
    margin-bottom: 1rem;
    font-size: 1.5rem;
    color: $gray;
  }

  width: 100%;

  &__values {
    margin: 0 auto;
    margin-bottom: 5rem;
  }

  &__value {
    display: flex;
    justify-content: space-between;
    font-size: 1.75rem;
    text-align: left;
    margin-bottom: 1rem;

    & > div:first-of-type {
      font-weight: 600;
      width: 20rem;
    }

    & > div:last-of-type {
      width: 100%;
    }
  }

  &__args {
    margin-bottom: 5rem;

    & table {
      & td {
        &:nth-child(2) {
          text-align: center;
        }
      }

      & thead {
        & th:nth-child(2) {
          text-align: center;
        }
      }
    }
  }

  &__defaults {
    & table {
      & td {
        &:nth-child(3) {
          text-transform: capitalize;
        }

        &:not(:last-of-type) {
          padding-right: 3rem;
        }
      }
    }
  }

  &__args,
  &__defaults {
    & table {
      font-size: 1.75rem;
      width: 100%;

      & tbody:before {
        content: "-";
        display: block;
        line-height: 0.5em;
        color: transparent;
      }

      & td {
        text-align: left;

        padding-bottom: 1rem;
      }

      & thead {
        text-align: left;
      }
    }
  }

  &__info {
    font-size: 1.75rem;
  }
}
</style>
