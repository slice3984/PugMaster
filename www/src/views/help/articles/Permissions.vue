<template>
  <help-article>
    <template #title>Set permissions, create a moderator role</template>
    <template #default>
      <div class="help-article__block">
        <h2>Set command permissions for a role</h2>
        <p>
          The bots command permission system grants server administrators full
          permissions to execute every command.
        </p>
        <p>
          To create a pickup moderator role you can use the permission command.
        </p>
      </div>
      <div class="help-article__section">
        <p>
          To create a pickup mod role which for example can warn, ban, unwarn
          and unban players you excecute:
        </p>
        <command-code>!permission @mod add warn ban unwarn unban</command-code>
        <p>
          @mod is the role you want to give permissions to, followed by add
          which tells the command to add permissions followed by a list of
          command names.
        </p>
        <p>
          You can also check which permissions the role already got by passing
          "show" to the command:
        </p>
        <command-code>!permission @mod show </command-code>
        <p>
          To revoke given command permissions you can pass "remove" to the
          command:
        </p>
        <command-code>!permission @mod remove ban unban </command-code>
        <p>This revokes the permissions to use the ban and unban commands.</p>
      </div>
      Commands which require permissions can be found on the
      <base-link to="/commands" mode="bold">commands</base-link> page in the
      "Admin" section.
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