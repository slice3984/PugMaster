<template>
  <help-article>
    <template #title>Settings</template>
    <template #default>
      <div class="help-article__section">
        <h2>Changing bot settings</h2>
        <p>Bot settings can be modified using the modify_bot command.</p>
        <p>
          The possible properties you can change are listed in the
          "Configuration variables" section. To change the bot prefix you would
          use:
        </p>
        <command-code>!modify_bot prefix ?</command-code>
        <p>
          Executing this command would result in updating the prefix to "?".
        </p>
      </div>
      <div class="help-article__section">
        <h2>Changing pickup settings</h2>
        <p>
          Pickups are modified using the modify_pickup command. The usable
          properties are listed in the "Configuration variables" section as
          well. Executing:
        </p>
        <command-code>!modify_pickup ca afkcheck true</command-code>
        <p>Would result in enabling the afk check for pickup ca.</p>
      </div>
      <h2>Modifying commands</h2>
      <p>
        For some commands its possible to change default settings. To see if it
        is possible to change command behaviour you can check the Commands page.
      </p>
      <p>To modify a command you use the modify_command command, example:</p>
      <command-code>!modify_command expire max_expire 2h</command-code>
      <p>
        Overrides the default of 1 day to 2 hours for the highest possible
        expire time.
      </p>
      <p>
        Using the same command it is also possible to disable or enable disabled
        commands again, to disable a command:
      </p>
      <command-code>!modify_command expire disable </command-code>
      <p>to enable the command again:</p>
      <command-code>!modify_command expire enable</command-code>
    </template>
  </help-article>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import HelpArticle from "@/components/help/HelpArticle.vue";
import CommandCode from "@/components/CommandCode.vue";

export default defineComponent({
  components: { HelpArticle, CommandCode },
});
</script>